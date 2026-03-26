import Image from '@tiptap/extension-image';

export type ImageAlignment = 'left' | 'center' | 'right' | 'full';

export function getAlignmentClass(alignment: ImageAlignment): string {
  switch (alignment) {
    case 'left':
      return 'float-left mr-4 mb-2 max-w-[50%]';
    case 'right':
      return 'float-right ml-4 mb-2 max-w-[50%]';
    case 'full':
      return 'block w-full my-4 clear-both';
    case 'center':
    default:
      return 'block mx-auto my-4 max-w-full clear-both';
  }
}

export const ImageWithAlignment = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: 'center' as ImageAlignment,
        parseHTML: (element) =>
          (element.getAttribute('data-alignment') as ImageAlignment) ?? 'center',
        renderHTML: (attributes) => ({
          'data-alignment': attributes.alignment,
          class: getAlignmentClass(attributes.alignment as ImageAlignment),
        }),
      },
    };
  },
});
