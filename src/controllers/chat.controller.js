import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { createStuffDocumentsChain } from "@langchain/classic/chains/combine_documents";
import { createRetrievalChain } from "@langchain/classic/chains/retrieval";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

const hfEmbeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

export const chatResponse = async (req, res) => {
  const { query, context = {}, chatHistory = [] } = req.body;
  const userRole = context.userRole || "guest";

  try {
    const vectorStore = await PineconeStore.fromExistingIndex(hfEmbeddings, {
      pineconeIndex,
    });

    const retriever = vectorStore.asRetriever({
      k: 4,
      filter: { role_required: { $in: [userRole, "all"] } },
    });

    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "openai/gpt-oss-120b",
      temperature: 0,
      streaming: true,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful system guide.
        Base your answers ONLY on the provided context. 
        If the context does not contain the answer, say: "I'm sorry, I don't have the instructions for that."
        Format steps using Markdown numbered lists. Bold UI elements. Keep the output simple as possible.
        
        Context: {context}`,
      ],
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
    ]);

    const combineDocsChain = await createStuffDocumentsChain({ llm, prompt });
    const retrievalChain = await createRetrievalChain({
      retriever,
      combineDocsChain,
    });

    const formattedHistory = chatHistory.map((msg) =>
      msg.role === "user"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    const response = await retrievalChain.invoke({
      input: query,
      chat_history: formattedHistory,
    });

    res.status(200).json({
      answer: response.answer,
    });
  } catch (error) {
    console.error("RAG Error:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
};
