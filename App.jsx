import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import {
  DollarSign, Package, TrendingUp, Clock,
  AlertTriangle, BarChart3
} from 'lucide-react';

// =======================================================================
// CONFIGURAÇÕES GERAIS
// =======================================================================
const API = {
  METRICS: 'http://localhost:8000/api/metrics/',
  PRODUCTS: 'http://localhost:8000/api/products/',
  SALES: 'http://localhost:8000/api/sales/',
};

// =======================================================================
// FUNÇÕES UTILITÁRIAS
// =======================================================================
const formatCurrency = (value, decimals = 0) => {
  if (isNaN(value)) return 'R$ 0';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatAxisValue = (value) => {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'K';
  return value.toLocaleString('pt-BR');
};

// =======================================================================
// HOOK PERSONALIZADO PARA FETCH
// =======================================================================
const useFetchData = (fetchFn, deps = []) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
};

// =======================================================================
// FUNÇÕES DE FETCH
// =======================================================================
const fetchGeneralMetrics = async () => {
  const res = await fetch(`${API.METRICS}general`);
  if (!res.ok) throw new Error('Falha ao buscar métricas gerais');
  return res.json();
};

const fetchRevenueByPeriod = async (period = '6m') => {
  const res = await fetch(`${API.METRICS}revenue_period?period=${period}`);
  if (!res.ok) throw new Error("Falha ao buscar faturamento por período");
  return await res.json();
};

const fetchTopProducts = async () => {
  const res = await fetch(`${API.PRODUCTS}top`);
  if (!res.ok) throw new Error('Falha ao buscar top produtos');
  return res.json();
};

const fetchSalesByHour = async () => {
  const res = await fetch(`${API.SALES}hourly`);
  if (!res.ok) throw new Error('Falha ao buscar vendas por hora');
  return res.json();
};

// =======================================================================
// COMPONENTES DE UI
// =======================================================================
const SkeletonLoader = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-200 h-28 rounded-xl"></div>
      ))}
    </div>
    <div className="h-96 bg-gray-200 rounded-xl"></div>
  </div>
);

const MetricCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <Icon className={`h-6 w-6 ${colorClass}`} />
    </div>
    <p className="mt-4 text-3xl font-extrabold text-gray-900">
      {typeof value === 'number' ? formatCurrency(value, 0) : value}
    </p>
  </div>
);

const PeriodSelector = ({ selected, onChange }) => {
  const options = [
    { label: '7 Dias', value: '7d' },
    { label: '30 Dias', value: '30d' },
    { label: 'Mês Atual', value: 'month' },
    { label: '6 Meses', value: '6m' },
  ];
  return (
    <div className="flex flex-wrap bg-gray-100 rounded-xl p-1 space-x-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-sm rounded-lg ${
            selected === opt.value
              ? 'bg-indigo-700 text-white'
              : 'text-gray-700 hover:bg-indigo-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const ErrorAlert = ({ message }) => (
  <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
    <AlertTriangle className="h-6 w-6 mr-3" />
    <div>
      <p className="font-bold">Erro de Conexão</p>
      <p className="text-sm">{message}</p>
    </div>
  </div>
);

// =======================================================================
// COMPONENTE PRINCIPAL
// =======================================================================
const App = () => {
  const [period, setPeriod] = useState('6m');

  const metrics = useFetchData(fetchGeneralMetrics, []);
  const products = useFetchData(fetchTopProducts, []);
  const sales = useFetchData(fetchSalesByHour, []);

  const [revenue, setRevenue] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    const loadRevenue = async () => {
      setRevenue({ data: null, loading: true, error: null });
      try {
        const data = await fetchRevenueByPeriod(period);
        setRevenue({ data, loading: false, error: null });
      } catch (err) {
        setRevenue({ data: null, loading: false, error: err.message });
      }
    };
    loadRevenue();
  }, [period]);

  const loading = metrics.loading || revenue.loading || products.loading || sales.loading;
  const apiError = metrics.error || revenue.error || products.error || sales.error;

  const peakHour = useMemo(() => {
    if (!sales.data) return 'N/A';
    const peak = sales.data.reduce((a, b) => (a.Pedidos > b.Pedidos ? a : b));
    return `${String(peak.hour).padStart(2, '0')}:00`;
  }, [sales.data]);

  const orderedRevenueData = useMemo(() => {
    if (!revenue.data) return [];
    const mapDays = { MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui', FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom' };
    const order = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };
    return revenue.data
      .map(d => ({ ...d, name: mapDays[d.name] || d.name, order: order[d.name] || 8 }))
      .sort((a, b) => a.order - b.order);
  }, [revenue.data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <h1 className="text-3xl font-bold mb-4">Painel de Análise Operacional</h1>
        <SkeletonLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
          <BarChart3 className="h-8 w-8 text-indigo-700 mr-3" />
          Painel de Análise Operacional
        </h1>
        <p className="text-gray-600 mt-2">Visão consolidada do desempenho recente.</p>
      </header>

      {apiError && <ErrorAlert message={apiError} />}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Faturamento Total" value={metrics.data?.totalRevenue} icon={DollarSign} colorClass="text-green-600" />
        <MetricCard title="Total de Vendas" value={metrics.data?.totalSales} icon={Package} colorClass="text-indigo-600" />
        <MetricCard title="Ticket Médio" value={metrics.data?.avgTicket} icon={TrendingUp} colorClass="text-blue-600" />
        <MetricCard title="Pico de Pedidos" value={peakHour} icon={Clock} colorClass="text-orange-500" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Faturamento por Dia da Semana</h2>
            <PeriodSelector selected={period} onChange={setPeriod} />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderedRevenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" tickFormatter={formatAxisValue} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Area type="monotone" dataKey="Faturamento (R$)" stroke="#4f46e5" fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Top 5 Produtos</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={products.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={formatAxisValue} />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(v, n) => n === 'Faturamento' ? formatCurrency(v) : v} />
                <Legend />
                <Bar dataKey="Faturamento" fill="#10b981" />
                <Bar dataKey="Vendas" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pedidos por hora */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Pedidos por Hora</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sales.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" />
            <YAxis tickFormatter={formatAxisValue} />
            <Tooltip formatter={(v) => v.toLocaleString('pt-BR')} />
            <Bar dataKey="Pedidos" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-4 text-sm text-gray-500 italic">
          Hora de pico: <span className="text-orange-600 font-semibold">{peakHour}</span>
        </p>
      </div>
    </div>
  );
};

export default App;