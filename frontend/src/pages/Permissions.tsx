import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { fuzzyPolicies } from "../lib/iam";
import { mergePolicies } from "../lib/policyCatalogue";
import {
  LoadingSkeleton,
  ResponsiveTable,
  type TableColumn,
} from "../components/ui";
import type { IamPolicySummary, Page } from "../types";
import { useAuthStore } from "../store/auth";

const catalogueStore = new Map<
  string,
  {
    rows: IamPolicySummary[];
    isComplete: boolean;
    nextCursor?: string;
    loadedCount: number;
    cacheStatus?: string;
    fetchedAt: number;
  }
>();

export default function Permissions() {
  const activeAccountId = useAuthStore(
    (state) =>
      state.session?.user?.activeAwsAccountRecordId ??
      state.session?.user?.activeAccountId,
  );
  const [scope, setScope] = useState<"AWS_MANAGED" | "CUSTOMER_MANAGED">(
    "AWS_MANAGED",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState(""),
    [debouncedSearch, setDebouncedSearch] = useState("");
  const [service, setService] = useState(""),
    [accessLevel, setAccessLevel] = useState("");
  const [selected, setSelected] = useState<string>(),
    navigate = useNavigate();
  const [rows, setRows] = useState<IamPolicySummary[]>([]),
    [isComplete, setIsComplete] = useState(false),
    [loadedCount, setLoadedCount] = useState(0),
    [cacheStatus, setCacheStatus] = useState<string>(),
    [loadingInitial, setLoadingInitial] = useState(true),
    [loadingMore, setLoadingMore] = useState(false),
    [error, setError] = useState<string>(),
    [slow, setSlow] = useState(false),
    [firstRenderMs, setFirstRenderMs] = useState<number>();
  const startedRef = useRef<number>(performance.now());
  const cacheKey = `${activeAccountId ?? "no-account"}:${scope}`;
  const detail = useQuery({
    queryKey: ["policy", selected],
    queryFn: () => api.policy(selected!),
    enabled: Boolean(selected),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const cached = catalogueStore.get(cacheKey);
    startedRef.current = performance.now();
    setError(undefined);
    setSlow(false);
    setSelected(undefined);
    if (cached) {
      setRows(cached.rows);
      setIsComplete(cached.isComplete);
      setLoadedCount(cached.loadedCount);
      setCacheStatus(cached.cacheStatus);
      setLoadingInitial(false);
      setLoadingMore(!cached.isComplete);
      setFirstRenderMs(0);
    } else {
      setRows([]);
      setIsComplete(false);
      setLoadedCount(0);
      setCacheStatus(undefined);
      setLoadingInitial(true);
      setLoadingMore(false);
      setFirstRenderMs(undefined);
    }
    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => setSlow(true), 5000);
    void loadCatalogue(scope, controller.signal, cached);
    return () => {
      controller.abort();
      window.clearTimeout(slowTimer);
    };
  }, [scope, reloadKey, activeAccountId]);

  async function loadCatalogue(
    activeScope: "AWS_MANAGED" | "CUSTOMER_MANAGED",
    signal: AbortSignal,
    cached?: {
      nextCursor?: string;
      isComplete: boolean;
      rows: IamPolicySummary[];
      loadedCount: number;
      cacheStatus?: string;
    },
  ) {
    let cursor = cached?.isComplete ? undefined : cached?.nextCursor;
    let current = cached?.rows ?? [];
    try {
      if (!cached) {
        setLoadingInitial(true);
        const first = await fetchPage(activeScope, undefined, signal);
        current = mergePolicies([], first.data);
        publish(cacheKey, current, first);
        setLoadingInitial(false);
        setLoadingMore(!first.isComplete);
        setFirstRenderMs(Math.round(performance.now() - startedRef.current));
        cursor = first.nextCursor;
        if (first.isComplete) return;
      }
      while (cursor && !signal.aborted) {
        setLoadingMore(true);
        const page = await fetchPage(activeScope, cursor, signal);
        current = mergePolicies(current, page.data);
        publish(cacheKey, current, page);
        cursor = page.nextCursor;
        if (page.isComplete) break;
      }
      setLoadingMore(false);
      setIsComplete(true);
      catalogueStore.set(cacheKey, {
        rows: current,
        isComplete: true,
        nextCursor: undefined,
        loadedCount: current.length,
        cacheStatus,
        fetchedAt: Date.now(),
      });
    } catch (err: any) {
      if (signal.aborted) return;
      setLoadingInitial(false);
      setLoadingMore(false);
      setError(
        err?.response?.data?.error?.message ??
          err?.message ??
          "Policy catalogue failed to load.",
      );
    }
  }

  async function fetchPage(
    activeScope: "AWS_MANAGED" | "CUSTOMER_MANAGED",
    cursor: string | undefined,
    signal: AbortSignal,
  ) {
    return api.policies(
      { scope: activeScope, limit: 100, cursor, sort: "name" },
      signal,
    ) as Promise<Page<IamPolicySummary>>;
  }
  function publish(
    activeScope: string,
    current: IamPolicySummary[],
    page: Page<IamPolicySummary>,
  ) {
    setRows(current);
    setIsComplete(Boolean(page.isComplete));
    setLoadedCount(page.loadedCount ?? current.length);
    setCacheStatus(page.cacheStatus);
    catalogueStore.set(activeScope, {
      rows: current,
      isComplete: Boolean(page.isComplete),
      nextCursor: page.nextCursor,
      loadedCount: page.loadedCount ?? current.length,
      cacheStatus: page.cacheStatus,
      fetchedAt: Date.now(),
    });
  }

  const displayed = useMemo(() => {
    let data = fuzzyPolicies(rows, debouncedSearch);
    if (service)
      data = data.filter((policy) => policy.services.includes(service));
    if (accessLevel)
      data = data.filter((policy) => policy.accessLevels.includes(accessLevel));
    return data;
  }, [rows, debouncedSearch, service, accessLevel]);
  const services = useMemo(
    () => [...new Set(rows.flatMap((p) => p.services))].filter(Boolean),
    [rows],
  );
  const columns: TableColumn<IamPolicySummary>[] = [
    {
      key: "name",
      header: "Policy name",
      priority: "high",
      render: (policy) => (
        <>
          <strong>{policy.policyName}</strong>
          <small className="mono wrap-cell">{policy.arn}</small>
        </>
      ),
    },
    {
      key: "type",
      header: "Type",
      priority: "medium",
      render: (policy) => policy.type.replace("_", " "),
    },
    {
      key: "services",
      header: "Services",
      priority: "medium",
      render: (policy) => (
        <span className="truncate-cell">
          {policy.services.join(", ") || "Analysing"}
        </span>
      ),
    },
    {
      key: "access",
      header: "Access levels",
      priority: "medium",
      render: (policy) => (
        <span className="truncate-cell">
          {policy.accessLevels.join(", ") || "Analysing"}
        </span>
      ),
    },
    //   {key:'risk',header:'Risk',priority:'high',render:policy=><span className={`risk ${policy.risk.level.toLowerCase()}`} title={policy.risk.flags.join(', ')||'Open policy for document-level analysis'}>{policy.risk.flags.some(flag=>flag.includes('Preliminary'))?'Analysing':policy.risk.level}</span>},
    {
      key: "risk",
      header: "Risk",
      priority: "high",
      render: (policy) => (
        <span
          className={`risk ${policy.risk.level.toLowerCase()}`}
          title={
            policy.risk.flags.join(", ") ||
            "Open policy for document-level analysis"
          }
        >
          {policy.risk.level}
        </span>
      ),
    },
    {
      key: "attached",
      header: "Attached",
      priority: "medium",
      align: "right",
      render: (policy) => policy.attachmentCount,
    },
    {
      key: "updated",
      header: "Last updated",
      priority: "low",
      render: (policy) => fmt(policy.updatedAt),
    },
  ];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Permissions</p>
          <h1>IAM managed policy catalogue</h1>
          <p>
            Live IAM policy metadata loads progressively. Policy documents and
            detailed risk analysis load only when a policy is selected.
          </p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={scope === "AWS_MANAGED" ? "active" : ""}
          onClick={() => setScope("AWS_MANAGED")}
        >
          AWS-managed policies
        </button>
        <button
          className={scope === "CUSTOMER_MANAGED" ? "active" : ""}
          onClick={() => setScope("CUSTOMER_MANAGED")}
        >
          Customer-managed policies
        </button>
      </div>
      <div className="filter-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policy name, ARN, description"
        />
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={accessLevel}
          onChange={(e) => setAccessLevel(e.target.value)}
        >
          <option value="">All access levels</option>
          {["Read", "Write", "Permissions management", "Unknown"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="catalogue-progress" role="status">
        {loadingInitial
          ? "Loading policy catalogue…"
          : `${displayed.length} shown · ${loadedCount || rows.length}${isComplete ? " policies loaded" : " policies loaded so far"}`}
        {loadingMore && <span>Loading more policies…</span>}
        {cacheStatus && <span>Cache: {cacheStatus}</span>}
        {firstRenderMs !== undefined && (
          <span>First render: {firstRenderMs}ms</span>
        )}
      </div>
      {slow && (
        <p className="warning">
          IAM is taking longer than expected. Loaded policies remain usable
          while the catalogue continues refreshing.
        </p>
      )}
      {error && (
        <p className="warning">
          {error}{" "}
          <button
            onClick={() => {
              catalogueStore.delete(cacheKey);
              setReloadKey((key) => key + 1);
            }}
          >
            Retry
          </button>
        </p>
      )}
      <section className="split">
        {loadingInitial && !rows.length ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <ResponsiveTable
            rows={displayed}
            columns={columns}
            getRowKey={(policy) => policy.arn}
            selectedKey={selected}
            onRowClick={(policy) => setSelected(policy.arn)}
            emptyTitle="No policies found"
            emptyBody="Try a different search, service, or access-level filter."
            rowActionLabel="Inspect policy"
          />
        )}
        <aside className="panel policy-detail">
          {detail.isLoading ? (
            <>
              <h2>Loading policy details</h2>
              <LoadingSkeleton rows={4} />
            </>
          ) : detail.data ? (
            <>
              <h2>{detail.data.policyName}</h2>
              <p>{detail.data.description}</p>
              <button
                onClick={() =>
                  navigate(
                    `/new-request?policyArn=${encodeURIComponent(detail.data.arn)}`,
                  )
                }
              >
                Request this policy
              </button>
              <dl>
                <div>
                  <dt>ARN</dt>
                  <dd className="mono">{detail.data.arn}</dd>
                </div>
                <div>
                  <dt>Current version</dt>
                  <dd>{detail.data.currentVersion}</dd>
                </div>
                <div>
                  <dt>Attached users</dt>
                  <dd>{detail.data.attachedUsers.join(", ") || "None"}</dd>
                </div>
                <div>
                  <dt>Attached roles</dt>
                  <dd>{detail.data.attachedRoles.join(", ") || "None"}</dd>
                </div>
              </dl>
              <h3>Risk observations</h3>
              <div className="chips">
                {detail.data.observations.map((x) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
              <h3>Allowed actions</h3>
              <div className="code-list">
                {detail.data.actions.map((a) => (
                  <code key={a}>{a}</code>
                ))}
              </div>
              <h3>Raw policy JSON</h3>
              <pre>{JSON.stringify(detail.data.document, null, 2)}</pre>
            </>
          ) : (
            <p className="muted">
              Select a policy to inspect statements, actions, resource scope,
              attachments, and detailed risk observations.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}

function fmt(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}
