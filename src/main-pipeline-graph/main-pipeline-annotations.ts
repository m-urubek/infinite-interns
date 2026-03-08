import * as Langgraph from "@langchain/langgraph";
import { type InvokeAgentState } from "../invoke-agent-graph/invoke-agent-types";
import { type PrdGeneratorState } from "../agents/prd-generator/prd-generator-types";

export const mainPipelineInputAnnotation = Langgraph.Annotation.Root({
  assignment: Langgraph.Annotation<string>(),
  projectDir: Langgraph.Annotation<string>(),
});

export const mainPipelineStateAnnotation = Langgraph.Annotation.Root({
  ...mainPipelineInputAnnotation.spec,

  invokeAgentState: Langgraph.Annotation<InvokeAgentState>(),

  prdGeneratorState: Langgraph.Annotation<PrdGeneratorState>(),
});
