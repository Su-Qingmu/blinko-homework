// Vector store removed in simplified build (no embeddings/RAG)
// Kept utility splitters for text chunking in non-RAG paths.

// Export the functional providers
export { LLMProvider } from './LLMProvider';
// EmbeddingProvider disabled in simplified build (no vector store)
// AudioProvider disabled in simplified build (no audio transcription)

// AiUtilities 桩(RAG/向量存储已下线,保留接口兼容)
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
export const AiUtilities = {
  VectorStore: async () => null, // 已下线
  MarkdownSplitter: () => new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 }),
  TokenTextSplitter: () => new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 }),
};

