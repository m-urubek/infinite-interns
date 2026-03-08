import * as Langgraph from "@langchain/langgraph";
import * as MainPipelineAnnotations from "./main-pipeline-annotations";
import * as PrdGeneratorGraph from "../agents/prd-generator/prd-generator-graph";

const graphBuilder = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
  input: MainPipelineAnnotations.mainPipelineInputAnnotation,
})
  .addNode("prdGeneratorGraph", PrdGeneratorGraph.prdGeneratorGraph)
  .addEdge("__start__", "prdGeneratorGraph")
  .addEdge("prdGeneratorGraph", "__end__");
// Export the uncompiled builder so CLI runners can inject their own checkpointer
export { graphBuilder };

// Default export compiled with MemorySaver for LangGraph Studio and direct use
export const graph = graphBuilder.compile({
  checkpointer: new Langgraph.MemorySaver(),
});
