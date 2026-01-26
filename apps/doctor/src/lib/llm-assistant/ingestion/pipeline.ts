/**
 * Ingestion Pipeline
 * Discovers, parses, and chunks markdown documentation for embedding
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { prisma } from '../db';
import {
  DOCS_BASE_PATH,
  DOCS_SKIP_FILES,
  CHUNK_TARGET_TOKENS,
  CHUNK_MAX_TOKENS,
  CHUNK_OVERLAP_TOKENS,
} from '../constants';
import { countTokens } from '../tokenizer';
import { generateEmbedding, generateEmbeddingsBatch, formatVectorLiteral } from '../embedding';
import { getModuleForFilePath, MODULE_DEFINITIONS } from '../modules';
import type { ParsedSection, DocumentChunk, IngestionResult, DocType } from '../types';

/**
 * Discover all markdown files in the docs directory.
 * Skips TECHNICAL_SPEC.md and other excluded files.
 */
export function discoverMarkdownFiles(basePath?: string): string[] {
  const docsPath = basePath || path.resolve(process.cwd(), DOCS_BASE_PATH);
  const files: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (!DOCS_SKIP_FILES.includes(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(docsPath);
  return files;
}

/**
 * Parse markdown content into sections split by headings.
 */
export function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let currentHeading = '';
  let currentLevel = 0;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section if it has content
      if (currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text.length > 0) {
          sections.push({
            heading: currentHeading,
            content: text,
            level: currentLevel,
          });
        }
      }
      currentHeading = headingMatch[2];
      currentLevel = headingMatch[1].length;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text.length > 0) {
      sections.push({
        heading: currentHeading,
        content: text,
        level: currentLevel,
      });
    }
  }

  return sections;
}

/**
 * Extract module and submodule from a file path.
 */
export function extractMetadataFromPath(filePath: string): {
  module: string;
  submodule?: string;
} {
  const moduleDef = getModuleForFilePath(filePath);
  if (moduleDef) {
    // Try to detect submodule from the file name
    const fileName = path.basename(filePath, '.md');
    const submodule = moduleDef.submodules.find(
      sm => sm.id === fileName || sm.name.toLowerCase() === fileName.toLowerCase()
    );
    return {
      module: moduleDef.id,
      submodule: submodule?.id,
    };
  }

  // Fallback: try to detect from path segments
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('medical-records')) return { module: 'medical-records' };
  if (normalized.includes('appointments')) return { module: 'appointments' };
  if (normalized.includes('practice-management')) return { module: 'practice-management' };
  if (normalized.includes('blog')) return { module: 'blog' };
  if (normalized.includes('voice-assistant')) return { module: 'voice-assistant' };
  if (normalized.includes('navigation')) return { module: 'navigation' };

  return { module: 'general' };
}

/**
 * Determine the document type based on content and heading.
 */
export function determineDocType(heading: string, content: string): DocType {
  const lower = (heading + ' ' + content.slice(0, 200)).toLowerCase();

  if (lower.includes('preguntas frecuentes') || lower.includes('faq') || heading.startsWith('¿')) {
    return 'faq';
  }
  if (lower.includes('cómo') || lower.includes('paso') || lower.includes('instrucciones')) {
    return 'howto';
  }
  if (lower.includes('propósito') || lower.includes('descripción general') || lower.includes('overview')) {
    return 'overview';
  }
  if (lower.includes('no se puede') || lower.includes('limitación') || lower.includes('no disponible')) {
    return 'limitation';
  }
  if (lower.includes('funcionalidad') || lower.includes('puede') || lower.includes('permite')) {
    return 'capability';
  }

  return 'reference';
}

/**
 * Split a section into chunks respecting token limits.
 * Uses paragraph-based splitting with overlap.
 */
export function chunkSection(
  section: ParsedSection,
  metadata: { module: string; submodule?: string; filePath: string }
): DocumentChunk[] {
  const fullContent = section.heading
    ? `## ${section.heading}\n\n${section.content}`
    : section.content;

  const totalTokens = countTokens(fullContent);

  // If it fits in one chunk, return as-is
  if (totalTokens <= CHUNK_MAX_TOKENS) {
    return [{
      content: fullContent,
      module: metadata.module,
      submodule: metadata.submodule,
      section: section.heading,
      docType: determineDocType(section.heading, section.content),
      filePath: metadata.filePath,
      heading: section.heading,
      tokenCount: totalTokens,
      chunkIndex: 0,
    }];
  }

  // Split by paragraphs (double newline)
  const paragraphs = section.content.split(/\n\n+/);
  const chunks: DocumentChunk[] = [];
  let currentChunkParts: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = countTokens(paragraph);

    if (currentTokens + paragraphTokens > CHUNK_TARGET_TOKENS && currentChunkParts.length > 0) {
      // Finalize current chunk
      const chunkContent = section.heading
        ? `## ${section.heading}\n\n${currentChunkParts.join('\n\n')}`
        : currentChunkParts.join('\n\n');

      chunks.push({
        content: chunkContent,
        module: metadata.module,
        submodule: metadata.submodule,
        section: section.heading,
        docType: determineDocType(section.heading, currentChunkParts.join(' ')),
        filePath: metadata.filePath,
        heading: section.heading,
        tokenCount: countTokens(chunkContent),
        chunkIndex,
      });

      chunkIndex++;

      // Keep last paragraph for overlap
      const lastPart = currentChunkParts[currentChunkParts.length - 1];
      if (lastPart && countTokens(lastPart) <= CHUNK_OVERLAP_TOKENS) {
        currentChunkParts = [lastPart];
        currentTokens = countTokens(lastPart);
      } else {
        currentChunkParts = [];
        currentTokens = 0;
      }
    }

    currentChunkParts.push(paragraph);
    currentTokens += paragraphTokens;
  }

  // Don't forget the remaining content
  if (currentChunkParts.length > 0) {
    const chunkContent = section.heading
      ? `## ${section.heading}\n\n${currentChunkParts.join('\n\n')}`
      : currentChunkParts.join('\n\n');

    chunks.push({
      content: chunkContent,
      module: metadata.module,
      submodule: metadata.submodule,
      section: section.heading,
      docType: determineDocType(section.heading, currentChunkParts.join(' ')),
      filePath: metadata.filePath,
      heading: section.heading,
      tokenCount: countTokens(chunkContent),
      chunkIndex,
    });
  }

  return chunks;
}

/**
 * Compute SHA-256 hash of file content.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Process a single markdown file into document chunks.
 */
export function processFile(filePath: string): DocumentChunk[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = parseMarkdownSections(content);
  const metadata = extractMetadataFromPath(filePath);

  // Normalize file path relative to project root
  const normalizedPath = filePath.replace(/\\/g, '/');
  const docsIndex = normalizedPath.indexOf('docs/llm-assistant/');
  const relativePath = docsIndex >= 0
    ? normalizedPath.slice(docsIndex)
    : normalizedPath;

  const allChunks: DocumentChunk[] = [];

  for (const section of sections) {
    const chunks = chunkSection(section, {
      ...metadata,
      filePath: relativePath,
    });
    allChunks.push(...chunks);
  }

  return allChunks;
}

/**
 * Run the full ingestion pipeline.
 * Processes all markdown files and stores chunks with embeddings.
 */
export async function runIngestionPipeline(options?: {
  force?: boolean;
  moduleFilter?: string;
}): Promise<IngestionResult[]> {
  const files = discoverMarkdownFiles();
  const results: IngestionResult[] = [];

  console.log(`Found ${files.length} markdown files to process`);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentHash = hashContent(content);
    const metadata = extractMetadataFromPath(filePath);

    // Skip if module filter doesn't match
    if (options?.moduleFilter && metadata.module !== options.moduleFilter) {
      continue;
    }

    // Normalize the path for DB storage
    const normalized = filePath.replace(/\\/g, '/');
    const docsIndex = normalized.indexOf('docs/llm-assistant/');
    const relativePath = docsIndex >= 0 ? normalized.slice(docsIndex) : normalized;

    // Check if file has changed (unless force mode)
    if (!options?.force) {
      const existing = await prisma.llmDocsFileHash.findUnique({
        where: { filePath: relativePath },
      });

      if (existing && existing.contentHash === contentHash) {
        console.log(`  Skipping unchanged: ${relativePath}`);
        continue;
      }
    }

    console.log(`  Processing: ${relativePath}`);

    // Process file into chunks
    const chunks = processFile(filePath);

    if (chunks.length === 0) {
      console.log(`    No chunks generated, skipping`);
      continue;
    }

    // Generate embeddings for all chunks in batch
    const texts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    // Delete existing chunks for this file
    await prisma.$executeRawUnsafe(
      `DELETE FROM llm_assistant.llm_docs_chunks WHERE file_path = $1`,
      relativePath
    );

    // Insert new chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const vectorLiteral = formatVectorLiteral(embedding);

      await prisma.$executeRawUnsafe(
        `INSERT INTO llm_assistant.llm_docs_chunks
         (content, embedding, module, submodule, section, doc_type, file_path, heading, token_count, chunk_index, created_at, updated_at)
         VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        chunk.content,
        vectorLiteral,
        chunk.module,
        chunk.submodule || null,
        chunk.section || null,
        chunk.docType,
        chunk.filePath,
        chunk.heading || null,
        chunk.tokenCount,
        chunk.chunkIndex
      );
    }

    // Update file hash
    await prisma.llmDocsFileHash.upsert({
      where: { filePath: relativePath },
      create: {
        filePath: relativePath,
        contentHash,
        moduleId: metadata.module,
      },
      update: {
        contentHash,
        moduleId: metadata.module,
        lastSynced: new Date(),
      },
    });

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    results.push({
      filePath: relativePath,
      module: metadata.module,
      submodule: metadata.submodule,
      chunksCreated: chunks.length,
      totalTokens,
    });

    console.log(`    Created ${chunks.length} chunks (${totalTokens} tokens)`);
  }

  // After ingestion, update module summaries
  await updateModuleSummaries();

  return results;
}

/**
 * Update module summary embeddings used for module detection.
 */
async function updateModuleSummaries(): Promise<void> {
  console.log('Updating module summaries...');

  for (const moduleDef of MODULE_DEFINITIONS) {
    const summaryText = `${moduleDef.name}: ${moduleDef.description}. Palabras clave: ${moduleDef.keywords.join(', ')}`;
    const embedding = await generateEmbedding(summaryText);
    const vectorLiteral = formatVectorLiteral(embedding);

    // Upsert module summary
    const existing = await prisma.llmModuleSummary.findUnique({
      where: { moduleId: moduleDef.id },
    });

    if (existing) {
      await prisma.$executeRawUnsafe(
        `UPDATE llm_assistant.llm_module_summaries
         SET name = $1, description = $2, keywords = $3, embedding = $4::vector, updated_at = NOW()
         WHERE module_id = $5`,
        moduleDef.name,
        moduleDef.description,
        moduleDef.keywords,
        vectorLiteral,
        moduleDef.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO llm_assistant.llm_module_summaries
         (module_id, name, description, keywords, embedding, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::vector, NOW(), NOW())`,
        moduleDef.id,
        moduleDef.name,
        moduleDef.description,
        moduleDef.keywords,
        vectorLiteral
      );
    }

    console.log(`  Updated summary for: ${moduleDef.id}`);
  }
}
