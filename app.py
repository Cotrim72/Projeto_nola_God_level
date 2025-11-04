import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2 import extras
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import Query

# =========================================================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# =========================================================================

# A URL do DB será injetada pelo Docker Compose (veja o arquivo atualizado)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://challenge:challenge_2024@postgres:5432/challenge_db")

def get_db_connection():
    """Cria e retorna uma conexão com o PostgreSQL."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao banco de dados: {e}")
        raise HTTPException(status_code=503, detail="Serviço de Banco de Dados Indisponível")

# =========================================================================
# LÓGICA DE NEGÓCIO (Consultas SQL)
# =========================================================================

def execute_query_single(conn, query, params=None):
    """Executa uma consulta e retorna uma única linha como dicionário."""
    with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
        cursor.execute(query, params)
        return cursor.fetchone()

def execute_query_all(conn, query, params=None):
    """Executa uma consulta e retorna todas as linhas como lista de dicionários."""
    with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()


def get_general_metrics(conn):
    """Busca Faturamento Total, Total de Vendas e Ticket Médio (últimos 6 meses)."""
    # A data de início é calculada para os últimos 6 meses a partir de hoje
    start_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')

    query = """
        SELECT
            COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
            COUNT(id) AS total_sales,
            COALESCE(AVG(total_amount), 0)::numeric AS avg_ticket
        FROM sales
        WHERE sale_status_desc = 'COMPLETED' AND created_at >= %s;
    """
    metrics = execute_query_single(conn, query, (start_date,))
    
    # Converte os tipos de Decimal para float/int para JSON
    return {
        "totalRevenue": int(float(metrics['total_revenue'])),
        "totalSales": metrics['total_sales'],
        "avgTicket": float(metrics['avg_ticket']),
    }


def get_top_products(conn):
    """Busca os 5 produtos mais vendidos por faturamento."""
    query = """
        SELECT
            p.name,
            SUM(ps.quantity)::numeric AS total_quantity,
            SUM(ps.total_price)::numeric AS total_revenue
        FROM product_sales ps
        JOIN products p ON ps.product_id = p.id
        JOIN sales s ON ps.sale_id = s.id
        WHERE s.sale_status_desc = 'COMPLETED'
        GROUP BY 1
        ORDER BY total_revenue DESC
        LIMIT 5;
    """
    products = execute_query_all(conn, query)
    
    # Formata para o frontend
    return [
        {
            "name": p['name'],
            "Vendas": int(float(p['total_quantity'])),
            "Faturamento": int(float(p['total_revenue']))
        }
        for p in products
    ]

def get_sales_by_hour(conn):
    """Calcula o volume de pedidos por hora do dia para identificar picos."""
    query = """
        SELECT
            TO_CHAR(created_at, 'HH24:00h') AS hour,
            COUNT(id) AS pedidos
        FROM sales
        WHERE sale_status_desc = 'COMPLETED'
        GROUP BY 1
        ORDER BY 1;
    """
    hourly_data = execute_query_all(conn, query)
    
    # O resultado já está no formato hour e pedidos, mas ajustamos o tipo
    return [
        {
            "hour": d['hour'],
            "Pedidos": d['pedidos']
        }
        for d in hourly_data
    ]

# =========================================================================
# APLICAÇÃO FASTAPI
# =========================================================================

app = FastAPI(
    title="Nola Analytics API",
    description="API de backend para o dashboard de análise de restaurante."
)

# Adiciona middleware CORS para permitir que o frontend React acesse a API
# O frontend rodará em uma porta diferente (ex: 3000), então precisamos permitir o acesso.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite acesso de qualquer origem (ideal para desenvolvimento local)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "API de Análise de Restaurante Rodando!"}

@app.get("/api/metrics/general", response_model=Dict[str, Any])
async def get_metrics_general():
    """Endpoint para buscar métricas gerais (faturamento, vendas, ticket)."""
    conn = get_db_connection()
    try:
        data = get_general_metrics(conn)
        return data
    finally:
        conn.close()

@app.get("/api/metrics/revenue_period", response_model=List[Dict[str, Any]])
async def get_metrics_revenue_period():
    """Endpoint que simula o faturamento por período (para simplificar, usaremos o Top 7 dias da semana)."""
    
    # Consulta real para faturamento por dia da semana
    query = """
        SELECT
            TO_CHAR(created_at, 'DY') AS day_name,
            TO_CHAR(created_at, 'ID')::int AS day_order,
            SUM(total_amount)::numeric AS total_revenue
        FROM sales
        WHERE sale_status_desc = 'COMPLETED'
        GROUP BY 1, 2
        ORDER BY day_order;
    """
    conn = get_db_connection()
    try:
        data = execute_query_all(conn, query)
        
        # Mapeia nomes abreviados para Português (pt_BR)
        day_names_pt = {
            'Mon': 'Seg', 'Tue': 'Ter', 'Wed': 'Qua', 'Thu': 'Qui',
            'Fri': 'Sex', 'Sat': 'Sáb', 'Sun': 'Dom'
        }
        
        return [
            {
                "name": day_names_pt.get(d['day_name'], d['day_name']),
                "Faturamento (R$)": int(float(d['total_revenue']))
            }
            for d in data
        ]

    finally:
        conn.close()

@app.get("/api/products/top", response_model=List[Dict[str, Any]])
async def get_products_top():
    """Endpoint para buscar os produtos mais vendidos por faturamento."""
    conn = get_db_connection()
    try:
        data = get_top_products(conn)
        return data
    finally:
        conn.close()

@app.get("/api/sales/hourly", response_model=List[Dict[str, Any]])
async def get_sales_hourly():
    """Endpoint para buscar o volume de pedidos por hora do dia."""
    conn = get_db_connection()
    try:
        data = get_sales_by_hour(conn)
        return data
    finally:
        conn.close()

@app.get("/api/metrics/revenue_period", response_model=List[Dict[str, Any]])
async def get_metrics_revenue_period(period: str = Query("7d", description="Período: 7d, 30d, month, 6m")):
    """Retorna faturamento por dia da semana filtrado pelo período escolhido."""
    
    now = datetime.now()

    if period == "7d":
        start_date = now - timedelta(days=7)
    elif period == "30d":
        start_date = now - timedelta(days=30)
    elif period == "month":
        start_date = now.replace(day=1)
    elif period == "6m":
        start_date = now - timedelta(days=180)
    else:
        raise HTTPException(status_code=400, detail="Período inválido.")

    query = """
        SELECT
            TO_CHAR(created_at, 'DY') AS day_name,
            TO_CHAR(created_at, 'ID')::int AS day_order,
            SUM(total_amount)::numeric AS total_revenue
        FROM sales
        WHERE sale_status_desc = 'COMPLETED' AND created_at >= %s
        GROUP BY 1, 2
        ORDER BY day_order;
    """

    conn = get_db_connection()
    try:
        data = execute_query_all(conn, query, (start_date,))
        day_names_pt = {
            'Mon': 'Seg', 'Tue': 'Ter', 'Wed': 'Qua', 'Thu': 'Qui',
            'Fri': 'Sex', 'Sat': 'Sáb', 'Sun': 'Dom'
        }
        return [
            {
                "name": day_names_pt.get(d['day_name'], d['day_name']),
                "Faturamento (R$)": int(float(d['total_revenue']))
            }
            for d in data
        ]
    finally:
        conn.close()


