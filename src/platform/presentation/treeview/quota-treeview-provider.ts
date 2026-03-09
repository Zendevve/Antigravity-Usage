import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';
import { QuotaState } from '../../../core/types/quota';
import {
  QuotaTreeNode,
  QuotaTreeNodeType,
  buildQuotaTree,
  treeNodeToTreeItem,
} from './quota-tree-node';
import { log } from '../../../util/logger';

/**
 * TreeDataProvider for quota breakdown TreeView
 */
export class QuotaTreeViewProvider implements vscode.TreeDataProvider<QuotaTreeNode> {
  private _onDidChangeTreeData = new EventEmitter<vscode.TreeView<QuotaTreeNode> | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private rootNode: QuotaTreeNode;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.rootNode = this.buildEmptyState();

    // Register TreeView
    const treeView = vscode.window.createTreeView('k1-antigravity.quotaBreakdown', {
      treeDataProvider: this,
      showCollapseAll: true,
      multiSelect: false,
    });

    // Register context menu commands
    this.registerContextMenuCommands(treeView);

    context.subscriptions.push(treeView);
    log.info('Quota TreeView initialized');
  }

  /**
   * Get the TreeItem for a given element
   */
  getTreeItem(element: QuotaTreeNode): vscode.TreeItem {
    return treeNodeToTreeItem(element);
  }

  /**
   * Get children of a given element
   */
  getChildren(element?: QuotaTreeNode): QuotaTreeNode[] {
    if (!element) {
      return this.rootNode.children || [];
    }

    return element.children || [];
  }

  /**
   * Get parent of a given element (for reveal support)
   */
  getParent?(element: QuotaTreeNode): QuotaTreeNode | undefined {
    // This is needed for treeView.reveal() to work properly
    return undefined;
  }

  /**
   * Update the tree with new quota data
   */
  public update(readings: QuotaState[]): void {
    if (!readings || readings.length === 0) {
      this.rootNode = this.buildEmptyState();
    } else {
      this.rootNode = buildQuotaTree(readings);
    }
    this._onDidChangeTreeData.fire();
    log.debug(`TreeView updated with ${readings.length} readings`);
  }

  /**
   * Build empty state node
   */
  private buildEmptyState(): QuotaTreeNode {
    return {
      id: 'root',
      label: 'No Quota Data',
      type: QuotaTreeNodeType.ROOT,
      description: 'Waiting for quota data...',
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      children: [],
    };
  }

  /**
   * Register context menu commands for tree items
   */
  private registerContextMenuCommands(treeView: vscode.TreeView<QuotaTreeNode>): void {
    // Show Details command
    const showDetailsCommand = vscode.commands.registerCommand(
      'k1-antigravity.treeview.showDetails',
      async (node: QuotaTreeNode) => {
        if (!node.quota) {
          vscode.window.showWarningMessage('No quota information available');
          return;
        }

        const details = [
          `Model: ${node.model || 'N/A'}`,
          `Endpoint: ${node.endpoint || 'default'}`,
          `Remaining: ${node.quota.remainingPercent.toFixed(1)}%`,
          `Tokens: ${node.quota.remainingTokens.toLocaleString()} / ${node.quota.totalTokens.toLocaleString()}`,
          `Used: ${node.quota.usedTokens.toLocaleString()}`,
          `Confidence: ${node.quota.confidence}`,
        ];

        const doc = new vscode.MarkdownString(details.join('\n\n'));
        await vscode.window.showInformationMessage(doc.value);
      }
    );

    // Pin Model command
    const pinModelCommand = vscode.commands.registerCommand(
      'k1-antigravity.treeview.pinModel',
      async (node: QuotaTreeNode) => {
        if (!node.model) {
          vscode.window.showWarningMessage('Cannot pin: no model selected');
          return;
        }

        const config = vscode.workspace.getConfiguration('k1-antigravity');
        await config.update('showModel', 'pinned', vscode.ConfigurationTarget.Global);
        await config.update('pinnedModel', node.model, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(`Pinned to model: ${node.model}`);
        log.info(`Model pinned: ${node.model}`);
      }
    );

    // Copy Value command
    const copyValueCommand = vscode.commands.registerCommand(
      'k1-antigravity.treeview.copyValue',
      async (node: QuotaTreeNode) => {
        if (!node.quota) {
          vscode.window.showWarningMessage('No quota value to copy');
          return;
        }

        const value = `${node.quota.remainingPercent.toFixed(1)}% (${node.quota.remainingTokens}/${node.quota.totalTokens})`;
        await vscode.env.clipboard.writeText(value);
        vscode.window.showInformationMessage('Quota value copied to clipboard');
      }
    );

    this.context.subscriptions.push(showDetailsCommand);
    this.context.subscriptions.push(pinModelCommand);
    this.context.subscriptions.push(copyValueCommand);
  }
}

/**
 * Creates the TreeView and returns the provider for external use
 */
export function createQuotaTreeView(context: vscode.ExtensionContext): QuotaTreeViewProvider {
  return new QuotaTreeViewProvider(context);
}
