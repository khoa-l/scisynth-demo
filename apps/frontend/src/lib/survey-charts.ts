import {
  datasetsGetDataset,
  previewsPreviewNode,
  publicGetPublishedChart,
  surveysGetSurveyChart,
  type NodePreview,
} from "@/client";
import { nodePreviewRequest } from "@/lib/dataset-nodes/graph";
import type { ChartBlock, LabelBlock } from "@/lib/survey-blocks";

interface ChartQueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<NodePreview>;
  select?: (preview: NodePreview) => NodePreview;
  staleTime?: number;
}

export type ChartQuery = (block: ChartBlock | LabelBlock) => ChartQueryOptions;

export function liveNodePreview(projectId: string, datasetId: string, nodeId: string) {
  return {
    queryKey: ["survey-chart", "live", projectId, datasetId, nodeId],
    queryFn: async () => {
      const { data: dataset } = await datasetsGetDataset({
        path: { project_id: projectId, dataset_id: datasetId },
        throwOnError: true,
      });
      const { data } = await previewsPreviewNode({
        body: nodePreviewRequest(dataset.content, nodeId),
        throwOnError: true,
      });
      return data;
    },
  };
}

export function liveCharts(projectId: string): ChartQuery {
  return ({ source }) => ({
    ...liveNodePreview(projectId, source?.dataset_id ?? "", source?.node_id ?? ""),
    select: (preview) => ({
      ...preview,
      channels: (source?.channels ?? []).flatMap((channel) => preview.channels[channel] ?? []),
    }),
  });
}

export function publishedCharts(publicId: string, versionId: string): ChartQuery {
  return ({ id }) => ({
    queryKey: ["survey-chart", "published", publicId, versionId, id],
    queryFn: async () => {
      const { data } = await publicGetPublishedChart({
        path: { public_id: publicId, version_id: versionId, block_id: id },
        throwOnError: true,
      });
      return data;
    },
    staleTime: Infinity,
  });
}

export function versionCharts(projectId: string, surveyId: string, versionId: string): ChartQuery {
  return ({ id }) => ({
    queryKey: ["survey-chart", "version", projectId, surveyId, versionId, id],
    queryFn: async () => {
      const { data } = await surveysGetSurveyChart({
        path: {
          project_id: projectId,
          survey_id: surveyId,
          version_id: versionId,
          block_id: id,
        },
        throwOnError: true,
      });
      return data;
    },
    staleTime: Infinity,
  });
}
