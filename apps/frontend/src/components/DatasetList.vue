<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import type { DatasetPublic } from "@/client";
import {
  datasetsDeleteDatasetMutation,
  datasetsGetDatasetsOptions,
  datasetsGetDatasetsQueryKey,
  datasetsUpdateDatasetMutation,
} from "@/client/@tanstack/vue-query.gen";
import ItemList from "@/components/ItemList.vue";

const props = defineProps<{ projectId: string }>();

const queryClient = useQueryClient();
const key = computed(() => datasetsGetDatasetsQueryKey({ path: { project_id: props.projectId } }));

const {
  data: datasets,
  isPending,
  isError,
} = useQuery(computed(() => datasetsGetDatasetsOptions({ path: { project_id: props.projectId } })));

const { mutateAsync: update } = useMutation({
  ...datasetsUpdateDatasetMutation(),
  onSuccess: (updated) =>
    queryClient.setQueryData<DatasetPublic[]>(key.value, (list) =>
      list?.map((dataset) => (dataset.id === updated.id ? updated : dataset)),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key.value });
  },
});

const { mutateAsync: remove } = useMutation({
  ...datasetsDeleteDatasetMutation(),
  onSuccess: (_, { path }) =>
    queryClient.setQueryData<DatasetPublic[]>(key.value, (list) =>
      list?.filter((dataset) => dataset.id !== path.dataset_id),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key.value });
  },
});
</script>

<template>
  <ItemList
    :items="datasets"
    :is-pending="isPending"
    :is-error="isError"
    noun="data"
    plural="data"
    :to="(dataset) => ({ name: 'project-dataset', params: { projectId, datasetId: dataset.id } })"
    :rename="
      (dataset, name) =>
        update({ path: { project_id: projectId, dataset_id: dataset.id }, body: { name } })
    "
    :remove="(dataset) => remove({ path: { project_id: projectId, dataset_id: dataset.id } })"
  />
</template>
