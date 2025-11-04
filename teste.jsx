import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Calendar, Clock, DollarSign, Package, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

// =========================================================================
// CONFIGURAÇÃO DA API REAL (FastAPI)
// Agora buscamos dados de http://localhost:8000
// =========================================================================
const API_BASE_URL = 'http://localhost:8000/api/metrics/';
const API_PRODUCT_URL = 'http://localhost:8000/api/products/';
const API_SALES_URL = 'http://localhost:8000/api/sales/';


/**
 * Formata um valor numérico para o padrão monetário BRL (R$).
 * @param {number} value 
 * @returns {string}
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Formata números grandes para o padrão brasileiro (ex: 1.000.000).
 * @param {number} value 
 * @returns {string}
 */
const formatNumber = (value) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

/**
 * Busca métricas gerais (Faturamento, Vendas, Ticket Médio) da API real.
 * @returns {Promise<Object>}
 */
const fetchGeneralMetrics = async () => {
  const response = await fetch(`${API_BASE_URL}general`);
  if (!response.ok) throw new Error("Falha ao buscar métricas gerais");
  const data = await response.json();

  // Adapta a resposta do backend para o formato do frontend
  return {
    totalRevenue: data.totalRevenue,
    totalSales: data.totalSales,
    avgTicket: parseFloat(data.avgTicket).toFixed(2),
  };
};

/**
 * Busca dados de faturamento por período (por dia da semana) da API real.
 * @returns {Promise<Array<Object>>}
 */
const fetchRevenueByPeriod = async () => {
  const response = await fetch(`${API_BASE_URL}revenue_period`);
  if (!response.ok) throw new Error("Falha ao buscar faturamento por período");
  return await response.json();
};

/**
 * Busca os 5 produtos mais vendidos por faturamento da API real.
 * @returns {Promise<Array<Object>>}
 */
const fetchTopProducts = async () => {
  const response = await fetch(`${API_PRODUCT_URL}top`);
  if (!response.ok) throw new Error("Falha ao buscar top produtos");
  // O backend retorna apenas 5, mas criaremos uma tabela para mais se houver
  return await response.json();
};

/**
 * Busca o volume de pedidos por hora (para identificar horários de pico) da API real.
 * @returns {Promise<Array<Object>>}
 */
const fetchSalesByHour = async () => {
  const response = await fetch(`${API_SALES_URL}hourly`);
  if (!response.ok) throw new Error("Falha ao buscar vendas por hora");
  return await response.json();
};


// =========================================================================
// COMPONENTES DE UI E LÓGICA DO DASHBOARD
// =========================================================================

// Componente de Cartão de Métrica Simples (Melhoria Visual)
const MetricCard = ({ title, value, icon: Icon, unit = '', color = 'indigo' }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 transition-transform hover:scale-[1.02] duration-300">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      <div className={`p-2 rounded-full bg-opacity-20 bg-${color}-500`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
    </div>
    <p className="mt-4 text-4xl font-extrabold text-gray-900 truncate">
      {unit === 'R$' ? formatCurrency(value) : formatNumber(value)}
      {unit !== 'R$' && unit !== '' && <span className="text-xl font-normal text-gray-600 ml-2">{unit}</span>}
    </p>
  </div>
);

// Componente para seleção de período
const PeriodSelector = ({ selectedPeriod, setSelectedPeriod }) => {
  const periods = [
    { label: 'Últimos 7 dias', value: '7d' },
    { label: 'Últimos 30 dias', value: '30d' },
    { label: 'Mês Atual', value: 'month' },
    { label: 'Últimos 6 Meses', value: '6m' }
  ];

  return (
    <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg shadow-inner">
      {periods.map(period => (
        <button
          key={period.value}
          onClick={() => setSelectedPeriod(period.value)}
          className={`px-3 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 ${
            selectedPeriod === period.value
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-700 hover:bg-white'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

// Componente da Tabela Detalhada de Produtos
const ProductTable = ({ products }) => {
    const [sortedProducts, setSortedProducts] = useState(products);
    const [sortConfig, setSortConfig] = useState({ key: 'Faturamento', direction: 'descending' });

    const sortTable = useCallback((key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    }, [sortConfig]);

    useEffect(() => {
        let sortableItems = [...products];
        sortableItems.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
        setSortedProducts(sortableItems);
    }, [products, sortConfig]);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? 
            <ChevronUp className="h-4 w-4 ml-1 text-indigo-400"/> : 
            <ChevronDown className="h-4 w-4 ml-1 text-indigo-400"/>;
    };

    const headerClasses = "px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors";

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mt-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2 text-pink-500"/>
                Detalhes de Produtos (Top {products.length})
            </h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className={headerClasses} onClick={() => sortTable('name')}>
                                <div className="flex items-center">Nome {getSortIcon('name')}</div>
                            </th>
                            <th className={headerClasses} onClick={() => sortTable('Vendas')}>
                                <div className="flex items-center">Vendas {getSortIcon('Vendas')}</div>
                            </th>
                            <th className={headerClasses} onClick={() => sortTable('Faturamento')}>
                                <div className="flex items-center">Faturamento (R$) {getSortIcon('Faturamento')}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedProducts.map((product, index) => (
                            <tr key={index} className="hover:bg-indigo-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatNumber(product.Vendas)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-semibold">{formatCurrency(product.Faturamento)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {products.length === 0 && <p className="text-center py-4 text-gray-500">Nenhum dado de produto encontrado.</p>}
        </div>
    );
};


// O Componente Principal da Aplicação
const App = () => {
  const [loading, setLoading] = useState(true);
  const [generalMetrics, setGeneralMetrics] = useState({});
  const [revenueData, setRevenueData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [salesByHour, setSalesByHour] = useState([]);
  // Mantendo o estado '6m' como selecionado
  const [selectedPeriod, setSelectedPeriod] = useState('6m'); 

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const metrics = await fetchGeneralMetrics();
      const revenue = await fetchRevenueByPeriod();
      const products = await fetchTopProducts();
      const hourly = await fetchSalesByHour();
      
      setGeneralMetrics(metrics);
      setRevenueData(revenue);
      setTopProducts(products);
      setSalesByHour(hourly);
    } catch (error) {
      console.error("Erro ao carregar dados da API. Verifique se o serviço 'nola-api' está rodando em http://localhost:8000:", error);
      // Resetar dados em caso de falha para mostrar estado de erro
      setGeneralMetrics({ totalRevenue: 0, totalSales: 0, avgTicket: 0 });
      setRevenueData([]);
      setTopProducts([]);
      setSalesByHour([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Apenas carregar dados na montagem
  }, [loadData]); 
  
  // Cálculo do Horário de Pico
  const peakHour = useMemo(() => {
    if (!salesByHour || salesByHour.length === 0) return 'N/A';
    const peak = salesByHour.reduce((prev, current) => 
      (prev.Pedidos > current.Pedidos) ? prev : current
    );
    return peak.hour;
  }, [salesByHour]);

  // Garantir a ordenação e tradução correta dos dias da semana para o gráfico
  const orderedRevenueData = useMemo(() => {
    if (!revenueData || revenueData.length === 0) return [];

    // Mapeia nomes abreviados para Português (pt_BR)
    // Usando as chaves em maiúsculas conforme o resultado do seu DB
    const dayNamesPt = {
        'MON': 'Seg', 'TUE': 'Ter', 'WED': 'Qua', 'THU': 'Qui',
        'FRI': 'Sex', 'SAT': 'Sáb', 'SUN': 'Dom'
    };

    // Ordenação: 1 (Mon) a 7 (Sun)
    const dayOrderMap = { 'Seg': 1, 'Ter': 2, 'Qua': 3, 'Qui': 4, 'Sex': 5, 'Sáb': 6, 'Dom': 7 };
    
    return revenueData
        .map(d => ({
            ...d,
            name: dayNamesPt[d.name.toUpperCase()] || d.name, // Traduz
        }))
        .sort((a, b) => dayOrderMap[a.name] - dayOrderMap[b.name]);
  }, [revenueData]);


  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-xl font-semibold text-indigo-700">A obter dados de análise...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      {/* Tailwind CSS e Font Inter são assumidos como carregados no ambiente */}

      <header className="mb-8 border-b pb-4 border-indigo-100">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl flex items-center">
          <TrendingUp className="h-8 w-8 text-indigo-600 mr-3"/>
          Painel de Análise Operacional (Nola Challenge)
        </h1>
        <p className="mt-2 text-md text-gray-600">
          Visualize o desempenho, identifique tendências e otimize operações (Métricas baseadas em {selectedPeriod === '6m' ? 'Últimos 6 meses' : 'dados simulados'}).
        </p>
      </header>

      {/* Seção de Métricas Chave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          title="Faturamento Total" 
          value={generalMetrics.totalRevenue || 0} 
          icon={DollarSign} 
          unit="R$" 
          color="indigo"
        />
        <MetricCard 
          title="Total de Pedidos" 
          value={generalMetrics.totalSales || 0} 
          icon={Package} 
          unit="pedidos" 
          color="green"
        />
        <MetricCard 
          title="Ticket Médio" 
          value={generalMetrics.avgTicket || 0} 
          icon={TrendingUp} 
          unit="R$" 
          color="teal"
        />
        <MetricCard 
          title="Hora de Pico" 
          value={peakHour} 
          icon={Clock} 
          unit="" 
          color="orange"
        />
      </div>

      {/* Seção de Gráficos e Comparações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Gráfico 1: Faturamento por Período */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-indigo-500"/>
                Faturamento por Dia da Semana
            </h2>
            {/* O PeriodSelector é meramente ilustrativo neste momento, mas mantém a UI */}
            <PeriodSelector selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} />
          </div>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderedRevenueData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" tickLine={false} axisLine={false} padding={{ left: 20, right: 20 }}/>
                <YAxis 
                    stroke="#6b7280" 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                    domain={['auto', 'auto']} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                  formatter={(value, name) => [formatCurrency(value), "Faturamento"]}
                  labelFormatter={(name) => `Dia: ${name}`}
                />
                <Area type="monotone" dataKey="Faturamento (R$)" stroke="#4f46e5" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} activeDot={{ r: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-6 text-sm text-gray-500 italic text-center">
            *Faturamento agrupado por dia da semana (mostra os picos de fim de semana).
          </p>
        </div>

        {/* Gráfico 2: Produtos Mais Vendidos */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Package className="h-5 w-5 mr-2 text-pink-500"/>
            Top 5 Produtos por Faturamento
          </h2>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis 
                    type="number" 
                    stroke="#6b7280" 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                />
                <YAxis dataKey="name" type="category" width={120} stroke="#6b7080" tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                  formatter={(value, name) => [name === 'Faturamento' ? formatCurrency(value) : formatNumber(value), name === 'Faturamento' ? 'Faturamento (R$)' : 'Vendas (Unidades)']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} layout="horizontal" verticalAlign="bottom" align="center"/>
                <Bar dataKey="Faturamento" fill="#10b981" radius={[8, 8, 0, 0]} name="Faturamento" />
                <Bar dataKey="Vendas" fill="#facc15" radius={[8, 8, 0, 0]} name="Vendas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Pedidos por Hora (Pico) */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-yellow-600"/>
                Volume de Pedidos por Hora (Identificação de Pico Operacional)
            </h2>
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByHour} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="hour" stroke="#6b7280" tickLine={false} axisLine={false} />
                        <YAxis 
                            stroke="#6b7280" 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => formatNumber(value)}
                            domain={['auto', 'auto']} 
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px' }}
                            labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                            formatter={(value) => [formatNumber(value), 'Pedidos']}
                            labelFormatter={(name) => `Hora: ${name}`}
                        />
                        <Bar 
                            dataKey="Pedidos" 
                            fill="#f59e0b" 
                            radius={[8, 8, 0, 0]} 
                            name="Pedidos"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
      
      {/* Tabela de Detalhes de Produtos */}
      <div className="lg:col-span-3">
        <ProductTable products={topProducts} />
      </div>

    </div>
  );
};

export default App;
