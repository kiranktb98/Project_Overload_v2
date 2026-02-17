import {
  type AnalystInput,
  AnalystInputSchema,
  type BatchAnalysis,
  BatchAnalysisSchema,
  type BatchPlan,
  BatchPlanSchema,
  type EvidencePacket,
  EvidencePacketSchema,
  type EvidenceRow,
  type ExecBrief,
  ExecBriefSchema,
  type JoinPlan,
  MAX_BATCHES,
  EVIDENCE_ROW_CAP
} from "@project-overload/shared";

export type EvidenceReductionResult =
  | {
      kind: "packet";
      packet: EvidencePacket;
      reduction_steps: string[];
    }
  | {
      kind: "batch_plan";
      batch_plan: BatchPlan;
      reduction_steps: string[];
    };

export type ReduceEvidenceOptions = {
  request_id: string;
  row_cap?: number;
  max_batches?: number;
  batch_method?: BatchPlan["method"];
  partition_field?: string;
  top_k_field?: string;
  stratify_by?: string;
};

export type BatchPlanOptions = {
  total_rows: number;
  row_cap?: number;
  max_batches?: number;
  method?: BatchPlan["method"];
  partition_field?: string;
};

export function reduceEvidence(
  rows: EvidenceRow[],
  options: ReduceEvidenceOptions
): EvidenceReductionResult {
  const rowCap = options.row_cap ?? EVIDENCE_ROW_CAP;
  const maxBatches = options.max_batches ?? MAX_BATCHES;
  const reductionSteps: string[] = [];

  let workingRows = [...rows];

  if (workingRows.length > rowCap) {
    workingRows = aggregateFirst(workingRows, options.partition_field);
    reductionSteps.push("aggregate_first");
  }

  if (workingRows.length > rowCap && options.top_k_field) {
    workingRows = topK(workingRows, options.top_k_field, rowCap);
    reductionSteps.push("top_k");
  }

  if (workingRows.length > rowCap && options.stratify_by) {
    workingRows = stratifiedSample(workingRows, options.stratify_by, rowCap);
    reductionSteps.push("stratified_sampling");
  }

  if (workingRows.length <= rowCap) {
    const packet = EvidencePacketSchema.parse({
      request_id: options.request_id,
      batch_index: 0,
      total_batches: 1,
      rows: workingRows,
      row_count: workingRows.length
    });

    return {
      kind: "packet",
      packet,
      reduction_steps: reductionSteps
    };
  }

  const batchPlan = planBatches({
    total_rows: workingRows.length,
    row_cap: rowCap,
    max_batches: maxBatches,
    method: options.batch_method,
    partition_field: options.partition_field
  });

  return {
    kind: "batch_plan",
    batch_plan: batchPlan,
    reduction_steps: [...reductionSteps, "batching"]
  };
}

export function planBatches(options: BatchPlanOptions): BatchPlan {
  const rowCap = options.row_cap ?? EVIDENCE_ROW_CAP;
  const maxBatches = options.max_batches ?? MAX_BATCHES;

  const requestedBatches = Math.max(1, Math.ceil(options.total_rows / rowCap));
  const boundedBatches = Math.min(requestedBatches, maxBatches);
  const method = options.method ?? "time_window";
  const partitionField = options.partition_field ?? defaultPartitionField(method);

  const prefixByMethod: Record<BatchPlan["method"], string> = {
    time_window: "window",
    dimension_partition: "partition",
    offset_limit: "offset"
  };

  const partitions = Array.from({ length: boundedBatches }, (_, index) =>
    `${prefixByMethod[method]}_${index + 1}`
  );

  return BatchPlanSchema.parse({
    method,
    partition_field: partitionField,
    partitions,
    total_batches: boundedBatches
  });
}

export function materializeBatches(
  rows: EvidenceRow[],
  requestId: string,
  batchPlan: BatchPlan,
  rowCap = EVIDENCE_ROW_CAP
): EvidencePacket[] {
  const packets: EvidencePacket[] = [];
  const totalBatches = batchPlan.total_batches;
  const batchSize = Math.max(1, Math.min(rowCap, Math.ceil(rows.length / totalBatches)));

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, rows.length);
    const batchRows = rows.slice(start, end);

    packets.push(
      EvidencePacketSchema.parse({
        request_id: requestId,
        batch_index: batchIndex,
        total_batches: totalBatches,
        rows: batchRows,
        row_count: batchRows.length
      })
    );
  }

  return packets;
}

export function mergeWithJoinPlan(
  leftRows: EvidenceRow[],
  rightRows: EvidenceRow[],
  joinPlan: JoinPlan
): EvidenceRow[] {
  const keyPairs = joinPlan.join_keys;
  const rightMap = buildRowMap(rightRows, keyPairs.map((pair) => pair.right_key));
  const leftMap = buildRowMap(leftRows, keyPairs.map((pair) => pair.left_key));
  const mergedRows: EvidenceRow[] = [];

  const mergeRows = (left: EvidenceRow | undefined, right: EvidenceRow | undefined): EvidenceRow => ({
    ...(left ?? {}),
    ...(right ?? {})
  });

  const keySet = new Set<string>();

  for (const leftRow of leftRows) {
    const key = composeKey(leftRow, keyPairs.map((pair) => pair.left_key));
    const rightCandidates = rightMap.get(key) ?? [];

    if (rightCandidates.length === 0) {
      if (joinPlan.join_type === "inner") {
        continue;
      }

      if (joinPlan.missing_key_policy === "drop") {
        continue;
      }

      mergedRows.push(leftRow);
      keySet.add(key);
      continue;
    }

    const deduped = applyDedupPolicy(rightCandidates, joinPlan.dedup_policy);
    for (const rightRow of deduped) {
      mergedRows.push(mergeRows(leftRow, rightRow));
      keySet.add(key);
    }
  }

  if (joinPlan.join_type === "right" || joinPlan.join_type === "full") {
    for (const rightRow of rightRows) {
      const key = composeKey(rightRow, keyPairs.map((pair) => pair.right_key));

      if (keySet.has(key) && joinPlan.join_type !== "full") {
        continue;
      }

      const leftCandidates = leftMap.get(key) ?? [];

      if (leftCandidates.length === 0) {
        if (joinPlan.missing_key_policy === "drop") {
          continue;
        }

        mergedRows.push(rightRow);
      } else if (joinPlan.join_type === "full") {
        const deduped = applyDedupPolicy(leftCandidates, joinPlan.dedup_policy);
        for (const leftRow of deduped) {
          mergedRows.push(mergeRows(leftRow, rightRow));
        }
      }
    }
  }

  return mergedRows;
}

export function analyzeBatch(input: AnalystInput): BatchAnalysis {
  const validatedInput = AnalystInputSchema.parse(input);
  const sampleRow = validatedInput.evidence_packet.rows[0] ?? {};

  const highlights = [
    `Batch ${validatedInput.batch_index + 1}/${validatedInput.total_batches} processed ${validatedInput.evidence_packet.row_count} rows.`,
    `Columns observed: ${Object.keys(sampleRow).slice(0, 4).join(", ") || "none"}.`
  ];

  const analysis = BatchAnalysisSchema.parse({
    request_id: validatedInput.request_id,
    batch_index: validatedInput.batch_index,
    total_batches: validatedInput.total_batches,
    highlights,
    risks: validatedInput.total_batches > 3 ? ["High batch count can dilute context."] : [],
    recommendations: ["Review appendix references before final approval."],
    confidence_score: validatedInput.total_batches > 3 ? 0.72 : 0.92,
    appendix_refs: [`${validatedInput.request_id}:batch-${validatedInput.batch_index + 1}`]
  });

  return analysis;
}

export function aggregateBatchAnalyses(
  analyses: BatchAnalysis[],
  previousBrief?: ExecBrief | null
): ExecBrief {
  const uniqueHighlights = unique(analyses.flatMap((analysis) => analysis.highlights));
  const uniqueRisks = unique(analyses.flatMap((analysis) => analysis.risks));
  const uniqueRecommendations = unique(analyses.flatMap((analysis) => analysis.recommendations));
  const appendixRefs = unique(analyses.flatMap((analysis) => analysis.appendix_refs));

  const score =
    analyses.length === 0
      ? 0
      : Number(
          (analyses.reduce((accumulator, analysis) => accumulator + analysis.confidence_score, 0) /
            analyses.length).toFixed(2)
        );

  const previousWhatChanged = previousBrief?.what_changed ?? [];
  const deltas = uniqueHighlights.filter((entry) => !previousWhatChanged.includes(entry));

  return ExecBriefSchema.parse({
    what_changed: uniqueHighlights.length > 0 ? uniqueHighlights : ["No material change captured."],
    why: uniqueRisks.length > 0 ? uniqueRisks : ["No major risk drivers were flagged in this run."],
    so_what:
      uniqueHighlights.length > 0
        ? ["Performance and trend shifts are detectable in the evidence batches."]
        : ["Evidence volume was low; monitor upcoming runs for stability."],
    what_to_do:
      uniqueRecommendations.length > 0
        ? uniqueRecommendations
        : ["Continue current monitoring cadence."],
    confidence: {
      score,
      rationale: analyses.length > 0 ? `Based on ${analyses.length} analyzed batch(es).` : "No analyses provided."
    },
    appendix_refs: appendixRefs,
    deltas_vs_last_run: deltas,
    generated_at: new Date().toISOString()
  });
}

function aggregateFirst(rows: EvidenceRow[], partitionField = "group"): EvidenceRow[] {
  const buckets = new Map<string, EvidenceRow>();

  for (const row of rows) {
    const key = String(row[partitionField] ?? "unknown");
    const existing = buckets.get(key) ?? { [partitionField]: key };

    for (const [field, value] of Object.entries(row)) {
      if (typeof value === "number") {
        const current = existing[field];
        existing[field] = (typeof current === "number" ? current : 0) + value;
      }
    }

    existing.count = (existing.count as number | undefined ?? 0) + 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.values());
}

function topK(rows: EvidenceRow[], field: string, k: number): EvidenceRow[] {
  return [...rows]
    .sort((left, right) => {
      const leftValue = typeof left[field] === "number" ? (left[field] as number) : 0;
      const rightValue = typeof right[field] === "number" ? (right[field] as number) : 0;
      return rightValue - leftValue;
    })
    .slice(0, k);
}

function stratifiedSample(rows: EvidenceRow[], field: string, targetSize: number): EvidenceRow[] {
  const groups = new Map<string, EvidenceRow[]>();

  for (const row of rows) {
    const key = String(row[field] ?? "unknown");
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const sampled: EvidenceRow[] = [];
  const groupEntries = Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  const perGroup = Math.max(1, Math.floor(targetSize / Math.max(groupEntries.length, 1)));

  for (const [, groupRows] of groupEntries) {
    sampled.push(...groupRows.slice(0, perGroup));
  }

  return sampled.slice(0, targetSize);
}

function defaultPartitionField(method: BatchPlan["method"]): string {
  if (method === "time_window") {
    return "event_time";
  }

  if (method === "dimension_partition") {
    return "dimension";
  }

  return "offset";
}

function composeKey(row: EvidenceRow, fields: string[]): string {
  return fields.map((field) => String(row[field] ?? "__missing__")).join("||");
}

function buildRowMap(rows: EvidenceRow[], fields: string[]): Map<string, EvidenceRow[]> {
  const map = new Map<string, EvidenceRow[]>();

  for (const row of rows) {
    const key = composeKey(row, fields);
    const existing = map.get(key) ?? [];
    existing.push(row);
    map.set(key, existing);
  }

  return map;
}

function applyDedupPolicy(rows: EvidenceRow[], policy: JoinPlan["dedup_policy"]): EvidenceRow[] {
  if (policy === "keep_first") {
    return rows.length > 0 ? [rows[0]] : [];
  }

  if (policy === "drop_duplicates") {
    const deduped = new Map<string, EvidenceRow>();

    for (const row of rows) {
      deduped.set(JSON.stringify(row), row);
    }

    return Array.from(deduped.values());
  }

  if (rows.length > 1) {
    throw new Error("Duplicate rows detected under dedup policy 'error'.");
  }

  return rows;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}