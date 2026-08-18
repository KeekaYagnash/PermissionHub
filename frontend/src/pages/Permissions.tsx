import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { fuzzyPolicies } from "../lib/iam";
import { mergePolicies } from "../lib/policyCatalogue";
import {
  Badge,
  Button,
  LoadingSkeleton,
  Modal,
  PageHeader,
  ResponsiveTable,
  RiskBadge,
  SearchToolbar,
  TechnicalDetails,
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
  const [selected, setSelected] = useState<IamPolicySummary>(),
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
    queryKey: ["policy", activeAccountId, selected?.arn],
    queryFn: () => api.policy(selected!.arn),
    enabled: Boolean(selected?.arn),
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
      header: "Source",
      priority: "medium",
      render: (policy) => policy.type === "AWS_MANAGED" ? "AWS managed" : "Customer",
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
      header: "Access",
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
        <span title={policy.risk.flags.join(", ") || "Open policy for document-level analysis"}>
          <RiskBadge risk={policy.risk.level} />
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
      header: "Updated",
      priority: "low",
      render: (policy) => fmt(policy.updatedAt),
    },
    {
      key: "request",
      header: "Action",
      priority: "high",
      render: (policy) => (
        <button
          className="table-action"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/new-request?policyArn=${encodeURIComponent(policy.arn)}`);
          }}
        >
          Request permission
        </button>
      ),
    },
  ];
  return (
    <div className="page">
      <PageHeader
        eyebrow="Permissions"
        title="IAM managed policies"
        description="Browse AWS permissions available for access requests. Policy documents and detailed risk analysis load only when selected."
        actions={<button className="primary-action" onClick={() => navigate('/new-request')}>Request access</button>}
      />
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
      <SearchToolbar resultCount={displayed.length}>
        <label className="search-field">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions"
            aria-label="Search permissions"
          />
        </label>
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
        {(search || service || accessLevel) && <button className="btn btn-secondary" onClick={() => { setSearch(''); setService(''); setAccessLevel(''); }}>Clear filters</button>}
      </SearchToolbar>
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
      {loadingInitial && !rows.length ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <ResponsiveTable
          rows={displayed}
          columns={columns}
          getRowKey={(policy) => policy.arn}
          selectedKey={selected?.arn}
          onRowClick={setSelected}
          emptyTitle="No policies found"
          emptyBody="Try a different search, service, or access-level filter."
          rowActionLabel="Inspect policy"
        />
      )}
      <PolicyDetailsModal
        policy={selected}
        detail={detail}
        onClose={() => setSelected(undefined)}
        onRequest={(arn) => navigate(`/new-request?policyArn=${encodeURIComponent(arn)}`)}
      />
    </div>
  );
}

function PolicyDetailsModal({policy,detail,onClose,onRequest}:{policy?:IamPolicySummary;detail:ReturnType<typeof useQuery<any>>;onClose:()=>void;onRequest:(arn:string)=>void}) {
  const resolved = detail.data?.arn === policy?.arn ? detail.data : undefined;
  const loading = Boolean(policy) && !resolved && detail.isFetching;
  return <Modal open={Boolean(policy)} onClose={onClose} title={policy?.policyName ?? 'Policy details'} subtitle={policy?.arn} eyebrow="Policy details" closeLabel="Close policy details" wide>
    {!policy ? <LoadingSkeleton rows={4}/> : <div className="entity-detail">
      <div className="entity-detail-title">
        <div>
          <h2>{policy.policyName}</h2>
          <p className="mono wrap-cell">{policy.arn}</p>
        </div>
        <div className="entity-badges"><Badge tone="info">{policy.type==='AWS_MANAGED'?'AWS managed':'Customer managed'}</Badge><RiskBadge risk={policy.risk?.level}/></div>
      </div>
      {loading ? <LoadingSkeleton rows={5}/> : detail.error && !resolved ? <div className="error-panel"><strong>Unable to load policy details</strong><span>{readDetailError(detail.error)}</span><Button variant="secondary" onClick={()=>detail.refetch()}>Retry</Button></div> : <PolicyDetailContent data={resolved ?? policy} onClose={onClose} onRequest={onRequest}/>}
    </div>}
  </Modal>
}

function PolicyDetailContent({data,onClose,onRequest}:{data:IamPolicySummary|any;onClose:()=>void;onRequest:(arn:string)=>void}) {
  return <>
      <section className="entity-section">
        <h3>Overview</h3>
        <dl className="detail-grid">
          <div><dt>Policy name</dt><dd>{data.policyName}</dd></div>
          <div><dt>Policy source</dt><dd>{data.type==='AWS_MANAGED'?'AWS managed':'Customer managed'}</dd></div>
          <div><dt>Default version</dt><dd>{data.currentVersion}</dd></div>
          <div><dt>Path</dt><dd>{data.path ?? 'Unavailable'}</dd></div>
          <div><dt>Created</dt><dd>{fmt(data.createdAt)}</dd></div>
          <div><dt>Updated</dt><dd>{fmt(data.updatedAt)}</dd></div>
          <div><dt>Attached</dt><dd>{data.attachmentCount} entities</dd></div>
          <div><dt>Boundary usage</dt><dd>{data.permissionsBoundaryUsageCount ?? 0}</dd></div>
        </dl>
      </section>
      <section className="entity-section">
        <h3>Access summary</h3>
        <dl className="detail-grid">
          <div><dt>Services</dt><dd>{data.services?.join(', ') || 'Analysing'}</dd></div>
          <div><dt>Access levels</dt><dd>{data.accessLevels?.join(', ') || 'Analysing'}</dd></div>
          <div><dt>Risk</dt><dd><RiskBadge risk={data.risk?.level}/></dd></div>
          <div><dt>Statements</dt><dd>{'statements' in data ? data.statements.length : 'Open detail unavailable'}</dd></div>
          <div><dt>Actions</dt><dd>{'actions' in data ? data.actions.length : 'Open detail unavailable'}</dd></div>
          <div><dt>Resources</dt><dd>{'resources' in data ? data.resources.join(', ') || 'None reported' : 'Open detail unavailable'}</dd></div>
        </dl>
        {'observations' in data && data.observations.length > 0 && <div className="chips">{data.observations.map((item:string)=><span key={item}>{item}</span>)}</div>}
      </section>
      {'statements' in data && <TechnicalDetails title="Policy statements" summary={`${data.statements.length} statement${data.statements.length===1?'':'s'}`}>
        <div className="statement-list">{data.statements.map((statement:unknown,index:number)=><article key={index}><strong>Statement {index+1}</strong><pre>{JSON.stringify(statement,null,2)}</pre></article>)}</div>
      </TechnicalDetails>}
      {'actions' in data && <TechnicalDetails title="Allowed actions" summary={`${data.actions.length} action${data.actions.length===1?'':'s'}`}>
        <div className="code-list">{data.actions.map((action:string)=><code key={action}>{action}</code>)}</div>
      </TechnicalDetails>}
      {'attachedUsers' in data && <section className="entity-section">
        <h3>Attached entities</h3>
        <dl className="detail-grid">
          <div><dt>Users</dt><dd>{data.attachedUsers.join(', ') || 'None'}</dd></div>
          <div><dt>Roles</dt><dd>{data.attachedRoles.join(', ') || 'None'}</dd></div>
          <div><dt>Groups</dt><dd>{data.attachedGroups.join(', ') || 'None'}</dd></div>
        </dl>
      </section>}
      {'document' in data && <TechnicalDetails title="Policy JSON" summary="Raw IAM policy document">
        <pre>{JSON.stringify(data.document, null, 2)}</pre>
      </TechnicalDetails>}
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={()=>onRequest(data.arn)}>Request permission</Button></div>
    </>
}

function fmt(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}
function readDetailError(error:unknown){return (error as any)?.response?.data?.error?.message??(error as Error)?.message??'The detail request failed.'}
