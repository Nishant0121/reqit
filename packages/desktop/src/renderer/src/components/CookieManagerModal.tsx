import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cookie as CookieIcon, Plus, Trash2, Search, Globe, Edit2, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type { Cookie } from '@reqit/core';

export interface CookieManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionPath?: string;
  initialDomain?: string;
}

export function CookieManagerModal({
  isOpen,
  onClose,
  collectionPath,
  initialDomain,
}: CookieManagerModalProps): React.JSX.Element | null {
  const [cookies, setCookies] = useState<Cookie[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing or adding cookie state
  const [editingCookie, setEditingCookie] = useState<Partial<Cookie> | null>(null);
  const [isNewCookie, setIsNewCookie] = useState<boolean>(false);

  // Load cookies from collection
  const loadCookies = useCallback(async () => {
    if (!window.reqitApi?.getCookies) return;
    try {
      const list = await window.reqitApi.getCookies(collectionPath);
      setCookies(list || []);
    } catch (err) {
      console.error('Failed to load cookies:', err);
    }
  }, [collectionPath]);

  useEffect(() => {
    if (isOpen) {
      loadCookies();
      setEditingCookie(null);
      setIsNewCookie(false);
      if (initialDomain) {
        setSelectedDomain(initialDomain);
      }
    }
  }, [isOpen, loadCookies, initialDomain]);

  // Distinct domains
  const domains = useMemo(() => {
    const set = new Set<string>();
    cookies.forEach(c => {
      if (c.domain) set.add(c.domain);
    });
    return Array.from(set).sort();
  }, [cookies]);

  // Filtered cookies
  const filteredCookies = useMemo(() => {
    return cookies.filter(c => {
      if (selectedDomain !== 'all' && c.domain !== selectedDomain) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.value.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        c.path.toLowerCase().includes(q)
      );
    });
  }, [cookies, selectedDomain, searchQuery]);

  // Handlers
  const handleStartAdd = () => {
    const domainDefault = selectedDomain !== 'all' ? selectedDomain : (domains[0] ?? 'localhost');
    setEditingCookie({
      name: '',
      value: '',
      domain: domainDefault,
      path: '/',
      httpOnly: false,
      secure: false,
    });
    setIsNewCookie(true);
  };

  const handleStartEdit = (cookie: Cookie) => {
    setEditingCookie({ ...cookie });
    setIsNewCookie(false);
  };

  const handleSaveCookie = async () => {
    if (!editingCookie || !editingCookie.name?.trim() || !editingCookie.domain?.trim()) return;
    const cookieToSave: Cookie = {
      name: editingCookie.name.trim(),
      value: editingCookie.value ?? '',
      domain: editingCookie.domain.trim(),
      path: editingCookie.path?.trim() || '/',
      expires: editingCookie.expires,
      maxAge: editingCookie.maxAge,
      httpOnly: editingCookie.httpOnly ?? false,
      secure: editingCookie.secure ?? false,
      sameSite: editingCookie.sameSite,
    };

    if (window.reqitApi?.updateCookie) {
      await window.reqitApi.updateCookie(collectionPath, cookieToSave);
      await loadCookies();
      setEditingCookie(null);
      setIsNewCookie(false);
    }
  };

  const handleDeleteCookie = async (c: Cookie) => {
    if (window.reqitApi?.deleteCookie) {
      await window.reqitApi.deleteCookie({
        collectionPath,
        domain: c.domain,
        path: c.path,
        name: c.name,
      });
      await loadCookies();
      if (
        editingCookie &&
        editingCookie.name === c.name &&
        editingCookie.domain === c.domain &&
        editingCookie.path === c.path
      ) {
        setEditingCookie(null);
      }
    }
  };

  const handleClearCookies = async () => {
    if (window.reqitApi?.clearCookies) {
      await window.reqitApi.clearCookies(collectionPath);
      await loadCookies();
      setEditingCookie(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Cookies"
      size="large"
      customFooter={
        <div className="flex w-full items-center justify-between">
          <div className="text-[12px] text-(--text-muted)">
            {cookies.length} {cookies.length === 1 ? 'cookie' : 'cookies'} in collection jar
          </div>
          <div className="flex items-center gap-2">
            {cookies.length > 0 && (
              <Button variant="danger" size="compact" onClick={handleClearCookies}>
                Clear All Cookies
              </Button>
            )}
            <Button variant="secondary" size="compact" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="-mx-6 -my-4 flex h-[420px] overflow-hidden">
        {/* Left column: Domains & Filter */}
        <div
          className="flex w-52 shrink-0 flex-col border-r p-3 select-none"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
              Domains
            </span>
            <button
              type="button"
              onClick={handleStartAdd}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-(--accent) hover:bg-(--bg-hover)"
              title="Add a new cookie"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute top-2 left-2 h-3.5 w-3.5 text-(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter cookies..."
              className="w-full rounded border border-(--border) bg-(--bg-input) py-1 pr-2 pl-7 text-[12px] text-(--text-primary) outline-none focus:border-(--accent)"
            />
          </div>

          {/* Domain list */}
          <div className="flex-1 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedDomain('all')}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
                selectedDomain === 'all'
                  ? 'bg-(--accent)/15 text-(--accent)'
                  : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span>All Domains</span>
              </span>
              <span className="text-[11px] text-(--text-muted)">{cookies.length}</span>
            </button>

            {domains.map(dom => {
              const count = cookies.filter(c => c.domain === dom).length;
              const isSelected = selectedDomain === dom;
              return (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setSelectedDomain(dom)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
                    isSelected
                      ? 'bg-(--accent)/15 text-(--accent)'
                      : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
                  }`}
                  title={dom}
                >
                  <span className="truncate">{dom}</span>
                  <span className="text-[11px] text-(--text-muted)">{count}</span>
                </button>
              );
            })}

            {domains.length === 0 && (
              <div className="p-3 text-center text-[12px] text-(--text-muted)">
                No cookies stored yet
              </div>
            )}
          </div>
        </div>

        {/* Right column: Cookie List or Add/Edit Form */}
        <div className="flex flex-1 flex-col overflow-hidden bg-(--bg-surface) p-3">
          {editingCookie ? (
            /* Add / Edit Form */
            <div className="flex flex-1 flex-col space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="text-[13px] font-semibold text-(--text-primary)">
                  {isNewCookie ? 'Add New Cookie' : `Edit Cookie: ${editingCookie.name}`}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCookie(null)}
                  className="rounded p-1 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-(--text-secondary)">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCookie.name || ''}
                    onChange={e => setEditingCookie({ ...editingCookie, name: e.target.value })}
                    placeholder="session_id"
                    className="w-full rounded border border-(--border) bg-(--bg-input) px-2.5 py-1.5 font-mono text-[12px] text-(--text-primary) outline-none focus:border-(--accent)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-(--text-secondary)">
                    Domain <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCookie.domain || ''}
                    onChange={e => setEditingCookie({ ...editingCookie, domain: e.target.value })}
                    placeholder="example.com"
                    className="w-full rounded border border-(--border) bg-(--bg-input) px-2.5 py-1.5 font-mono text-[12px] text-(--text-primary) outline-none focus:border-(--accent)"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-(--text-secondary)">
                  Value
                </label>
                <textarea
                  value={editingCookie.value || ''}
                  onChange={e => setEditingCookie({ ...editingCookie, value: e.target.value })}
                  rows={3}
                  placeholder="cookie value..."
                  className="w-full rounded border border-(--border) bg-(--bg-input) p-2 font-mono text-[12px] text-(--text-primary) outline-none focus:border-(--accent)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-(--text-secondary)">
                    Path
                  </label>
                  <input
                    type="text"
                    value={editingCookie.path || '/'}
                    onChange={e => setEditingCookie({ ...editingCookie, path: e.target.value })}
                    placeholder="/"
                    className="w-full rounded border border-(--border) bg-(--bg-input) px-2.5 py-1.5 font-mono text-[12px] text-(--text-primary) outline-none focus:border-(--accent)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-(--text-secondary)">
                    Expires (UTC date string or ISO)
                  </label>
                  <input
                    type="text"
                    value={editingCookie.expires || ''}
                    onChange={e =>
                      setEditingCookie({
                        ...editingCookie,
                        expires: e.target.value.trim() || undefined,
                      })
                    }
                    placeholder="Leave empty for Session cookie"
                    className="w-full rounded border border-(--border) bg-(--bg-input) px-2.5 py-1.5 font-mono text-[12px] text-(--text-primary) outline-none focus:border-(--accent)"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-(--text-secondary)">
                  <input
                    type="checkbox"
                    checked={editingCookie.httpOnly ?? false}
                    onChange={e =>
                      setEditingCookie({ ...editingCookie, httpOnly: e.target.checked })
                    }
                    className="h-3.5 w-3.5 rounded border-(--border) accent-(--accent)"
                  />
                  <span>HttpOnly</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-(--text-secondary)">
                  <input
                    type="checkbox"
                    checked={editingCookie.secure ?? false}
                    onChange={e => setEditingCookie({ ...editingCookie, secure: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-(--border) accent-(--accent)"
                  />
                  <span>Secure</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button variant="secondary" size="compact" onClick={() => setEditingCookie(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="compact"
                  onClick={handleSaveCookie}
                  disabled={!editingCookie.name?.trim() || !editingCookie.domain?.trim()}
                >
                  Save Cookie
                </Button>
              </div>
            </div>
          ) : (
            /* Cookies Table */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-medium text-(--text-secondary)">
                  {selectedDomain === 'all' ? 'All Cookies' : `Cookies for ${selectedDomain}`} (
                  {filteredCookies.length})
                </div>
                <Button variant="secondary" size="compact" onClick={handleStartAdd}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Cookie
                </Button>
              </div>

              {filteredCookies.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-(--text-muted)">
                  <CookieIcon className="mb-2 h-8 w-8 stroke-[1.25] opacity-40" />
                  <p className="text-[13px] font-medium">No cookies found</p>
                  <p className="mt-1 max-w-xs text-[11px]">
                    Responses with Set-Cookie headers automatically store cookies here, or you can
                    add one manually.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto rounded border border-(--border)">
                  <table className="w-full border-collapse text-left font-mono text-[11px]">
                    <thead className="sticky top-0 border-b border-(--border) bg-(--bg-elevated) text-(--text-secondary)">
                      <tr>
                        <th className="px-2.5 py-1.5 font-medium">Name</th>
                        <th className="px-2.5 py-1.5 font-medium">Value</th>
                        <th className="px-2.5 py-1.5 font-medium">Domain</th>
                        <th className="px-2.5 py-1.5 font-medium">Path</th>
                        <th className="px-2.5 py-1.5 font-medium">Expires</th>
                        <th className="px-2.5 py-1.5 text-center font-medium">Flags</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--border)">
                      {filteredCookies.map((c, i) => {
                        const parsedExp = c.expires ? Date.parse(c.expires) : NaN;
                        const isExpired = !isNaN(parsedExp) ? parsedExp < Date.now() : false;
                        return (
                          <tr
                            key={`${c.domain}-${c.path}-${c.name}-${i}`}
                            className="group transition-colors hover:bg-(--bg-hover)/50"
                          >
                            <td className="px-2.5 py-1.5 font-semibold text-(--text-primary)">
                              {c.name}
                            </td>
                            <td
                              className="max-w-[150px] truncate px-2.5 py-1.5 text-(--text-secondary)"
                              title={c.value}
                            >
                              {c.value}
                            </td>
                            <td className="px-2.5 py-1.5 text-(--text-secondary)">{c.domain}</td>
                            <td className="px-2.5 py-1.5 text-(--text-secondary)">{c.path}</td>
                            <td
                              className={`px-2.5 py-1.5 ${isExpired ? 'font-semibold text-red-400' : 'text-(--text-muted)'}`}
                            >
                              {c.expires ? new Date(c.expires).toLocaleDateString() : 'Session'}
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1 font-sans text-[10px]">
                                {c.httpOnly && (
                                  <span
                                    className="py-0.2 rounded bg-blue-500/15 px-1 font-medium text-blue-400"
                                    title="HttpOnly"
                                  >
                                    H
                                  </span>
                                )}
                                {c.secure && (
                                  <span
                                    className="py-0.2 rounded bg-emerald-500/15 px-1 font-medium text-emerald-400"
                                    title="Secure"
                                  >
                                    S
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-sans">
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(c)}
                                  className="rounded p-1 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                                  title="Edit cookie"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCookie(c)}
                                  className="rounded p-1 text-(--text-secondary) hover:bg-red-500/10 hover:text-red-400"
                                  title="Delete cookie"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
