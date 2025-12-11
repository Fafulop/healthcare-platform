// Data Loading Utilities
// Load doctor data from JSON files

import { promises as fs } from 'fs';
import path from 'path';
import type { DoctorProfile } from '@/types/doctor';

/**
 * Get doctor profile by slug
 */
export async function getDoctorBySlug(slug: string): Promise<DoctorProfile | null> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'doctors', `${slug}.json`);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const doctor: DoctorProfile = JSON.parse(fileContents);
    return doctor;
  } catch (error) {
    console.error(`Error loading doctor with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Get all doctor slugs for static generation
 */
export async function getAllDoctorSlugs(): Promise<string[]> {
  try {
    const doctorsDirectory = path.join(process.cwd(), 'src', 'data', 'doctors');
    const filenames = await fs.readdir(doctorsDirectory);

    return filenames
      .filter((filename) => filename.endsWith('.json'))
      .map((filename) => filename.replace(/\.json$/, ''));
  } catch (error) {
    console.error('Error reading doctors directory:', error);
    return [];
  }
}

/**
 * Get all doctors (for listing pages, if needed)
 */
export async function getAllDoctors(): Promise<DoctorProfile[]> {
  try {
    const slugs = await getAllDoctorSlugs();
    const doctors = await Promise.all(
      slugs.map((slug) => getDoctorBySlug(slug))
    );

    return doctors.filter((doctor): doctor is DoctorProfile => doctor !== null);
  } catch (error) {
    console.error('Error loading all doctors:', error);
    return [];
  }
}
