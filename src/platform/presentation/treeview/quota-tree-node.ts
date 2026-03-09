import { TreeItem, TreeItemCollapsibleState, ThemeIcon } from 'vscode';
import { QuotaState, SourceReading } from '../../../core/types/quota';

/**
 * Tree node type for the quota breakdown TreeView
 */
export enum QuotaTreeNodeType {
  ROOT = 'root',
  MODEL = 'model',
  ENDPOINT = 'endpoint',
}

/**
 * Quota information attached to tree nodes
 */
export interface QuotaInfo {
  remainingPercent: number;
  remainingTokens: number;
  totalTokens: number;
  usedTokens: number;
  confidence: string;
  sources: string[];
}

/**
 * Tree node data structure for VSCode TreeView
 */
export interface QuotaTreeNode {
  id: string;
  label: string;
  description?: string;
  type: QuotaTreeNodeType;
  icon?: string;
  quota?: QuotaInfo;
  children?: QuotaTreeNode[];
  collapsibleState: TreeItemCollapsibleState;
  model?: string;
  endpoint?: string;
}

/**
 * Convert tree node to VSCode TreeItem
 */
export function treeNodeToTreeItem(node: QuotaTreeNode): TreeItem {
  const item = new TreeItem(
    node.label,
    node.collapsibleState
  );

  item.id = node.id;
  item.description = node.description;
  item.contextValue = node.type;

  // Set icon based on type and quota status
  if (node.quota) {
    item.iconPath = getQuotaIcon(node.quota.remainingPercent);
    item.tooltip = buildTooltip(node);
  } else if (node.type === QuotaTreeNodeType.ROOT) {
    item.iconPath = new ThemeIcon('pie-chart');
  } else if (node.type === QuotaTreeNodeType.MODEL) {
    item.iconPath = new ThemeIcon('symbol-property');
  } else if (node.type === QuotaTreeNodeType.ENDPOINT) {
    item.iconPath = new ThemeIcon('symbol-method');
  }

  return item;
}

/**
 * Get icon based on quota percentage
 */
function getQuotaIcon(percent: number): ThemeIcon {
  if (percent <= 10) {
    return new ThemeIcon('error');
  } else if (percent <= 20) {
    return new ThemeIcon('warning');
  } else if (percent <= 50) {
    return new ThemeIcon('info');
  }
  return new ThemeIcon('check');
}

/**
 * Build tooltip for tree node
 */
function buildTooltip(node: QuotaTreeNode): string {
  if (!node.quota) return node.label;

  const q = node.quota;
  const lines = [
    `Remaining: ${q.remainingPercent.toFixed(1)}%`,
    `Tokens: ${formatNumber(q.remainingTokens)} / ${formatNumber(q.totalTokens)}`,
    `Used: ${formatNumber(q.usedTokens)}`,
    `Confidence: ${q.confidence}`,
  ];

  if (q.sources.length > 0) {
    lines.push(`Sources: ${q.sources.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format number with K/M suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Build tree nodes from quota state
 */
export function buildQuotaTree(readings: QuotaState[]): QuotaTreeNode {
  // Group readings by model
  const modelMap = new Map<string, QuotaTreeNode[]>();

  for (const reading of readings) {
    const sourceReading = reading as SourceReading;
    const model = sourceReading.model || 'unknown';

    if (!modelMap.has(model)) {
      modelMap.set(model, []);
    }

    const endpointNode: QuotaTreeNode = {
      id: `${model}-default`,
      label: 'default',
      type: QuotaTreeNodeType.ENDPOINT,
      description: `${sourceReading.remainingPercent.toFixed(1)}% remaining`,
      collapsibleState: TreeItemCollapsibleState.None,
      quota: {
        remainingPercent: sourceReading.remainingPercent,
        remainingTokens: sourceReading.remainingTokens,
        totalTokens: sourceReading.totalTokens,
        usedTokens: sourceReading.totalTokens - sourceReading.remainingTokens,
        confidence: 'HIGH',
        sources: [sourceReading.sourceId],
      },
      model,
      endpoint: 'default',
    };

    modelMap.get(model)!.push(endpointNode);
  }

  // Build model nodes
  const modelNodes: QuotaTreeNode[] = [];
  let totalRemainingTokens = 0;
  let totalTokens = 0;

  for (const [model, endpoints] of modelMap) {
    const modelRemaining = endpoints.reduce((sum, e) => sum + (e.quota?.remainingTokens || 0), 0);
    const modelTotal = endpoints.reduce((sum, e) => sum + (e.quota?.totalTokens || 0), 0);
    const modelPercent = modelTotal > 0 ? (modelRemaining / modelTotal) * 100 : 0;

    totalRemainingTokens += modelRemaining;
    totalTokens += modelTotal;

    // Aggregate sources from all endpoints
    const allSources = new Set<string>();
    endpoints.forEach(e => e.quota?.sources.forEach(s => allSources.add(s)));

    modelNodes.push({
      id: `model-${model}`,
      label: model,
      type: QuotaTreeNodeType.MODEL,
      description: `${modelPercent.toFixed(1)}% remaining`,
      collapsibleState: TreeItemCollapsibleState.Expanded,
      children: endpoints,
      quota: {
        remainingPercent: modelPercent,
        remainingTokens: modelRemaining,
        totalTokens: modelTotal,
        usedTokens: modelTotal - modelRemaining,
        confidence: 'HIGH',
        sources: Array.from(allSources),
      },
      model,
    });
  }

  // Calculate total percentage
  const totalPercent = totalTokens > 0 ? (totalRemainingTokens / totalTokens) * 100 : 0;

  // Build root node
  return {
    id: 'root',
    label: 'Total Quota',
    type: QuotaTreeNodeType.ROOT,
    description: `${totalPercent.toFixed(1)}% remaining`,
    collapsibleState: TreeItemCollapsibleState.Expanded,
    children: modelNodes,
    quota: {
      remainingPercent: totalPercent,
      remainingTokens: totalRemainingTokens,
      totalTokens: totalTokens,
      usedTokens: totalTokens - totalRemainingTokens,
      confidence: 'HIGH',
      sources: [],
    },
  };
}
