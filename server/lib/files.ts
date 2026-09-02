// FileService stub - simplified build does not include file attachments
// Kept as no-op stub to satisfy import sites; full functionality removed.

export const FileService = {
  async getFile(_path: string) {
    throw new Error('File service disabled in simplified build');
  },
  async deleteFile(_path: string) {
    return;
  },
  validateAndResolvePath(_path: string, _base: string) {
    throw new Error('File service disabled in simplified build');
  },
};