import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Plus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Copy,
  Edit2,
  Trash2,
  AlertCircle,
  FolderPlus,
  FilePlus,
} from 'lucide-react';
import type { HttpMethod, CollectionTree, CollectionTreeNode } from '@reqit/core';
import { MethodBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { strings } from '../lib/strings';
import { useCollectionStore } from '../stores/collectionStore';
import { useRequestStore } from '../stores/requestStore';
import { SidebarHistory } from './SidebarHistory';

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
}

export interface SidebarProps {
  width: number;
  onWidthChange: (w: number) => void;
  tree?: CollectionTree | null;
  activeRequestId: string;
  onSelectRequestNode?: (node: CollectionTreeNode) => void;
  requests?: RequestItem[];
  onSelectRequest?: (id: string) => void;
  onNewRequest?: () => void;
}

export function Sidebar({
  width,
  onWidthChange,
  tree,
  activeRequestId,
  onSelectRequestNode,
  requests = [],
  onSelectRequest,
  onNewRequest,
}: SidebarProps): React.JSX.Element {
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');

  // Expanded folders set
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Inline creation state: { parentDir: string; type: 'request' | 'folder' }
  const [creatingItem, setCreatingItem] = useState<{
    parentDir: string;
    type: 'request' | 'folder';
  } | null>(null);
  const [creatingName, setCreatingName] = useState('');

  // Inline rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  // Active context menu for a node
  const [contextMenu, setContextMenu] = useState<{
    node: CollectionTreeNode;
    x: number;
    y: number;
  } | null>(null);

  // Drag-and-drop state
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    path: string;
    position: 'inside' | 'before' | 'after';
  } | null>(null);

  const {
    createRequest,
    createFolder,
    renameItem,
    duplicateRequest,
    deleteItem,
    moveItem,
    reorderFolder,
  } = useCollectionStore();

  const drafts = useRequestStore(s => s.drafts);

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingItem) {
      createInputRef.current?.focus();
      createInputRef.current?.select();
    }
  }, [creatingItem]);

  useEffect(() => {
    if (renamingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingPath]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutside = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleOutside);
      window.addEventListener('contextmenu', handleOutside);
    }
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('contextmenu', handleOutside);
    };
  }, [contextMenu]);

  // Auto-expand root and matching folders on tree change or filter
  useEffect(() => {
    if (tree?.rootPath) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(tree.rootPath);
        return next;
      });
    }
  }, [tree]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(480, startWidth + (moveEvent.clientX - startX)));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Node filtering helper
  const matchesFilter = (node: CollectionTreeNode, query: string): boolean => {
    if (node.name.toLowerCase().includes(query)) return true;
    if (node.request?.url.toLowerCase().includes(query)) return true;
    if (node.children) {
      return node.children.some(child => matchesFilter(child, query));
    }
    return false;
  };

  // Inline submit for creation
  const handleCreateSubmit = async () => {
    if (!creatingItem || !creatingName.trim()) {
      setCreatingItem(null);
      setCreatingName('');
      return;
    }

    const { parentDir, type } = creatingItem;
    const name = creatingName.trim();
    setCreatingItem(null);
    setCreatingName('');

    if (type === 'request') {
      const newNode = await createRequest(parentDir, name);
      if (newNode && onSelectRequestNode) {
        onSelectRequestNode(newNode);
      }
    } else {
      await createFolder(parentDir, name);
      setExpandedFolders(prev => new Set(prev).add(parentDir));
    }
  };

  // Inline submit for rename
  const handleRenameSubmit = async () => {
    if (!renamingPath || !renamingName.trim()) {
      setRenamingPath(null);
      setRenamingName('');
      return;
    }
    const itemPath = renamingPath;
    const name = renamingName.trim();
    setRenamingPath(null);
    setRenamingName('');
    await renameItem(itemPath, name);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, node: CollectionTreeNode) => {
    e.stopPropagation();
    setDraggedPath(node.path);
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverNode = (
    e: React.DragEvent,
    targetNode: CollectionTreeNode,
    _parentPath: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedPath || draggedPath === targetNode.path) {
      setDragOverTarget(null);
      return;
    }

    if (targetNode.type === 'folder') {
      setDragOverTarget({ path: targetNode.path, position: 'inside' });
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const position = e.clientY < mid ? 'before' : 'after';
      setDragOverTarget({ path: targetNode.path, position });
    }
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnNode = async (
    e: React.DragEvent,
    targetNode: CollectionTreeNode,
    parentDir: string,
    siblings: CollectionTreeNode[],
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const srcPath = draggedPath || e.dataTransfer.getData('text/plain');
    setDraggedPath(null);
    setDragOverTarget(null);

    if (!srcPath || srcPath === targetNode.path) return;

    if (targetNode.type === 'folder' && dragOverTarget?.position === 'inside') {
      // Move into folder
      await moveItem(srcPath, targetNode.path);
      setExpandedFolders(prev => new Set(prev).add(targetNode.path));
      return;
    }

    // Drop before or after a sibling -> reorder within parentDir
    const srcSlug = srcPath.replace(/\\/g, '/').split('/').pop() || '';
    const targetSlug = targetNode.relativePath.replace(/\\/g, '/').split('/').pop() || '';

    const currentSlugs = siblings.map(
      s => s.relativePath.replace(/\\/g, '/').split('/').pop() || '',
    );
    const filtered = currentSlugs.filter(s => s !== srcSlug);
    const targetIndex = filtered.indexOf(targetSlug);

    let insertIndex = targetIndex;
    if (dragOverTarget?.position === 'after') {
      insertIndex = targetIndex + 1;
    }

    filtered.splice(insertIndex >= 0 ? insertIndex : filtered.length, 0, srcSlug);
    await reorderFolder(parentDir, filtered);
  };

  // Recursive tree renderer
  const renderTreeNode = (
    node: CollectionTreeNode,
    parentDir: string,
    siblings: CollectionTreeNode[],
    depth = 0,
  ): React.JSX.Element | null => {
    const query = filterText.trim().toLowerCase();
    if (query && !matchesFilter(node, query)) {
      return null;
    }

    const isFolder = node.type === 'folder';
    const activeDraft = !isFolder ? drafts[node.path] || drafts[node.id] : undefined;
    const displayMethod = activeDraft?.method || node.method || 'GET';
    const displayName = activeDraft?.name || node.name;
    const isExpanded = expandedFolders.has(node.path) || (query.length > 0 && isFolder);
    const isSelected = !isFolder && node.path === activeRequestId;
    const isRenaming = renamingPath === node.path;
    const isDragOver = dragOverTarget?.path === node.path;

    return (
      <div key={node.path} className="flex flex-col">
        {/* Node item row */}
        <div
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={0}
          draggable={!isRenaming}
          onDragStart={e => handleDragStart(e, node)}
          onDragOver={e => handleDragOverNode(e, node, parentDir)}
          onDragLeave={() => {
            if (dragOverTarget?.path === node.path) setDragOverTarget(null);
          }}
          onDrop={e => handleDropOnNode(e, node, parentDir, siblings)}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path);
            } else if (onSelectRequestNode) {
              onSelectRequestNode(node);
            }
          }}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ node, x: e.clientX, y: e.clientY });
          }}
          className="group transition-fast app-focus-ring relative flex h-7 cursor-pointer items-center px-2 text-[13px] select-none"
          style={{
            paddingLeft: `${depth * 14 + 8}px`,
            backgroundColor: isSelected
              ? 'var(--accent-subtle)'
              : isDragOver
                ? 'var(--bg-hover)'
                : 'transparent',
            borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
            boxShadow:
              isDragOver && dragOverTarget?.position === 'before'
                ? 'inset 0 2px 0 0 var(--accent)'
                : isDragOver && dragOverTarget?.position === 'after'
                  ? 'inset 0 -2px 0 0 var(--accent)'
                  : undefined,
          }}
          onMouseEnter={e => {
            if (!isSelected && !isDragOver) {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }
          }}
          onMouseLeave={e => {
            if (!isSelected && !isDragOver) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Folder chevron / Request method icon */}
          {isFolder ? (
            <span
              className="mr-1 flex h-4 w-4 shrink-0 items-center justify-center"
              style={{ color: 'var(--text-muted)' }}
              onClick={e => {
                e.stopPropagation();
                toggleFolder(node.path);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          ) : (
            <span className="mr-1.5 shrink-0">
              <MethodBadge method={displayMethod} short />
            </span>
          )}

          {/* Folder Icon */}
          {isFolder && (
            <span className="mr-1.5 shrink-0" style={{ color: 'var(--accent)' }}>
              {isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5" />
              ) : (
                <Folder className="h-3.5 w-3.5" />
              )}
            </span>
          )}

          {/* Title or inline rename input */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renamingName}
              onChange={e => setRenamingName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenamingPath(null);
                  setRenamingName('');
                }
              }}
              onBlur={handleRenameSubmit}
              onClick={e => e.stopPropagation()}
              className="h-5.5 flex-1 rounded border border-(--accent) bg-(--bg-input) px-1 text-[12px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          ) : (
            <span
              className="flex-1 truncate"
              style={{
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isSelected || isFolder ? 500 : 400,
              }}
              title={node.path}
              onDoubleClick={e => {
                e.stopPropagation();
                setRenamingPath(node.path);
                setRenamingName(node.name);
              }}
            >
              {displayName}
            </span>
          )}

          {/* Parse error warning indicator */}
          {node.parseError && (
            <span
              className="ml-1.5 flex shrink-0 items-center"
              title={`YAML Parse Error:\n${node.parseError}`}
            >
              <AlertCircle
                className="h-3.5 w-3.5"
                style={{ color: 'var(--status-err)' }}
                strokeWidth={2}
              />
            </span>
          )}

          {/* Quick actions on hover */}
          <div className="ml-1 hidden shrink-0 items-center gap-0.5 group-hover:flex">
            {isFolder && (
              <>
                <button
                  type="button"
                  title="New Request in folder"
                  onClick={e => {
                    e.stopPropagation();
                    setCreatingItem({ parentDir: node.path, type: 'request' });
                    setCreatingName('');
                    setExpandedFolders(prev => new Set(prev).add(node.path));
                  }}
                  className="rounded p-1 text-(--text-muted) hover:bg-(--bg-elevated) hover:text-(--text-primary)"
                >
                  <Plus className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  title="New Subfolder"
                  onClick={e => {
                    e.stopPropagation();
                    setCreatingItem({ parentDir: node.path, type: 'folder' });
                    setCreatingName('');
                    setExpandedFolders(prev => new Set(prev).add(node.path));
                  }}
                  className="rounded p-1 text-(--text-muted) hover:bg-(--bg-elevated) hover:text-(--text-primary)"
                >
                  <FolderPlus className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </>
            )}
            <button
              type="button"
              title="More actions"
              onClick={e => {
                e.stopPropagation();
                setContextMenu({ node, x: e.clientX, y: e.clientY });
              }}
              className="rounded p-1 text-(--text-muted) hover:bg-(--bg-elevated) hover:text-(--text-primary)"
            >
              <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Children (if folder and expanded) */}
        {isFolder && isExpanded && (
          <div className="flex flex-col">
            {/* Inline creation input inside this folder */}
            {creatingItem?.parentDir === node.path && (
              <div
                className="flex h-7 items-center px-2"
                style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
              >
                {creatingItem.type === 'folder' ? (
                  <Folder className="mr-1.5 h-3.5 w-3.5 shrink-0 text-(--accent)" />
                ) : (
                  <FilePlus className="mr-1.5 h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
                )}
                <input
                  ref={createInputRef}
                  type="text"
                  value={creatingName}
                  placeholder={`Name ${creatingItem.type}...`}
                  onChange={e => setCreatingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') setCreatingItem(null);
                  }}
                  onBlur={handleCreateSubmit}
                  className="h-5.5 flex-1 rounded border border-(--accent) bg-(--bg-input) px-1 text-[12px] outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {node.children && node.children.length > 0 ? (
              node.children.map(child =>
                renderTreeNode(child, node.path, node.children || [], depth + 1),
              )
            ) : creatingItem?.parentDir !== node.path ? (
              <div
                className="py-1 text-[11px] select-none"
                style={{
                  paddingLeft: `${(depth + 1) * 14 + 8}px`,
                  color: 'var(--text-muted)',
                }}
              >
                Empty folder
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const hasTreeNodes = tree?.tree && tree.tree.length > 0;

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r select-none"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Sidebar Navigation Tabs */}
      <div
        className="flex h-9 items-center justify-between border-b px-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-4 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('collections')}
            className="transition-fast app-focus-ring pb-1"
            style={{
              color: activeTab === 'collections' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom:
                activeTab === 'collections' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {strings.sidebar.collectionsTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="transition-fast app-focus-ring pb-1"
            style={{
              color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom:
                activeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {strings.sidebar.historyTab}
          </button>
        </div>

        {/* New Request or New Folder Button (Collections only) */}
        {activeTab === 'collections' && (
          <div className="flex items-center gap-1">
            {tree?.rootPath && (
              <Button
                variant="ghost"
                size="compact"
                onClick={() => {
                  setCreatingItem({ parentDir: tree.rootPath, type: 'folder' });
                  setCreatingName('');
                }}
                title="New Folder in root"
                aria-label="New Folder"
                className="flex h-7 w-7 items-center justify-center p-0 text-(--text-secondary) hover:text-(--text-primary)"
              >
                <FolderPlus className="h-5 w-5" strokeWidth={1.75} />
              </Button>
            )}

            <Button
              variant="ghost"
              size="compact"
              onClick={() => {
                if (tree?.rootPath) {
                  setCreatingItem({ parentDir: tree.rootPath, type: 'request' });
                  setCreatingName('');
                } else if (onNewRequest) {
                  onNewRequest();
                }
              }}
              title={strings.sidebar.newRequest}
              aria-label={strings.sidebar.newRequest}
              className="flex h-7 w-7 items-center justify-center p-0 text-(--text-secondary) hover:text-(--text-primary)"
            >
              <Plus className="h-5 w-5" strokeWidth={1.75} />
            </Button>
          </div>
        )}
      </div>

      {activeTab === 'history' ? (
        <SidebarHistory />
      ) : (
        <>
          {/* Filter Bar with Count and Clear Button */}
          <div className="border-b p-2" style={{ borderColor: 'var(--border)' }}>
            <div
              className="relative flex h-7 items-center rounded-sm border px-2 text-[12px]"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <Search
                className="mr-1.5 h-4 w-4 shrink-0"
                style={{ color: 'var(--text-muted)' }}
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                placeholder={strings.sidebar.filterPlaceholder}
                className="app-focus-ring w-full bg-transparent text-[12px] outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label={strings.sidebar.filterRequests}
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  className="transition-fast rounded-xs p-0.5 hover:bg-(--bg-hover)"
                  style={{ color: 'var(--text-muted)' }}
                  title={strings.sidebar.clearFilter}
                  aria-label={strings.sidebar.clearFilter}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>

          {/* Requests Tree / List */}
          <div
            className="flex-1 overflow-y-auto py-1"
            onDragOver={e => {
              if (tree?.rootPath && draggedPath) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={async e => {
              if (!tree?.rootPath || !draggedPath) return;
              e.preventDefault();
              const src = draggedPath;
              setDraggedPath(null);
              setDragOverTarget(null);
              await moveItem(src, tree.rootPath);
            }}
          >
            {/* Inline input for root-level new item */}
            {tree?.rootPath && creatingItem?.parentDir === tree.rootPath && (
              <div className="flex h-7 items-center px-3">
                {creatingItem.type === 'folder' ? (
                  <Folder className="mr-1.5 h-3.5 w-3.5 shrink-0 text-(--accent)" />
                ) : (
                  <FilePlus className="mr-1.5 h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
                )}
                <input
                  ref={createInputRef}
                  type="text"
                  value={creatingName}
                  placeholder={`Name ${creatingItem.type}...`}
                  onChange={e => setCreatingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') setCreatingItem(null);
                  }}
                  onBlur={handleCreateSubmit}
                  className="h-5.5 flex-1 rounded border border-(--accent) bg-(--bg-input) px-1 text-[12px] outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {tree ? (
              hasTreeNodes ? (
                <div role="tree" aria-label="Requests Tree">
                  {tree.tree.map((node: CollectionTreeNode) =>
                    renderTreeNode(node, tree.rootPath, tree.tree, 0),
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  No requests in this collection yet. Click + to create one.
                </div>
              )
            ) : requests.length > 0 ? (
              // Legacy/Fallback list when no collection loaded
              <div role="tree" aria-label="Requests">
                {requests.map(req => {
                  const isSelected = req.id === activeRequestId;
                  const draft = drafts[req.id];
                  const displayMethod = draft?.method || req.method;
                  const displayName = draft?.name || req.name;
                  return (
                    <div
                      key={req.id}
                      role="treeitem"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => onSelectRequest?.(req.id)}
                      className="transition-fast app-focus-ring relative flex h-7 cursor-pointer items-center px-3 text-[13px]"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
                        borderLeft: isSelected
                          ? '2px solid var(--accent)'
                          : '2px solid transparent',
                      }}
                    >
                      <MethodBadge method={displayMethod} short />
                      <span
                        className="ml-1.5 flex-1 truncate"
                        style={{
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 500 : 400,
                        }}
                        title={displayName}
                      >
                        {displayName}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {strings.sidebar.noRequestsYet}
              </div>
            )}
          </div>
        </>
      )}

      {/* Context Menu Modal / Popup */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-md border py-1 text-[12px] shadow-xl"
          style={{
            top: `${contextMenu.y}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 180)}px`,
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            minWidth: '160px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.node.type === 'folder' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setCreatingItem({ parentDir: contextMenu.node.path, type: 'request' });
                  setCreatingName('');
                  setExpandedFolders(prev => new Set(prev).add(contextMenu.node.path));
                  setContextMenu(null);
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Request</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingItem({ parentDir: contextMenu.node.path, type: 'folder' });
                  setCreatingName('');
                  setExpandedFolders(prev => new Set(prev).add(contextMenu.node.path));
                  setContextMenu(null);
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>New Folder</span>
              </button>
              <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
              <button
                type="button"
                onClick={() => {
                  setRenamingPath(contextMenu.node.path);
                  setRenamingName(contextMenu.node.name);
                  setContextMenu(null);
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Rename Folder</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const toDelete = contextMenu.node.path;
                  setContextMenu(null);
                  await deleteItem(toDelete);
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--status-err) hover:bg-(--bg-hover)"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Folder</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={async () => {
                  const src = contextMenu.node.path;
                  setContextMenu(null);
                  const newNode = await duplicateRequest(src);
                  if (newNode && onSelectRequestNode) {
                    onSelectRequestNode(newNode);
                  }
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Duplicate Request</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenamingPath(contextMenu.node.path);
                  setRenamingName(contextMenu.node.name);
                  setContextMenu(null);
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Rename Request</span>
              </button>
              <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
              <button
                type="button"
                onClick={async () => {
                  const toDelete = contextMenu.node.path;
                  setContextMenu(null);
                  await deleteItem(toDelete);
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--status-err) hover:bg-(--bg-hover)"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete to Trash</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Drag handle for resizing */}
      <div
        onMouseDown={handleMouseDownResize}
        className="transition-fast absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize hover:bg-(--accent)"
        title="Resize sidebar"
        aria-hidden="true"
      />
    </aside>
  );
}
