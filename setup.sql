-- ============================================================
-- GrapeDist ERP — Supabase Setup SQL
-- Execute this SQL in Supabase Dashboard → SQL Editor
-- ============================================================

-- PROFILES (connected to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nome TEXT,
  role TEXT CHECK (role IN ('dono', 'operador', 'vendedor')) DEFAULT 'operador',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'operador'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- PRODUTORES
CREATE TABLE IF NOT EXISTS produtores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  telefone TEXT,
  cidade TEXT,
  estado TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- VARIEDADES
CREATE TABLE IF NOT EXISTS variedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT,
  cor TEXT,
  categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ARMAZENS
CREATE TABLE IF NOT EXISTS armazens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cidade TEXT,
  capacidade_tons NUMERIC,
  tipo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  telefone TEXT,
  cidade TEXT,
  limite_credito NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ENTRADAS
CREATE TABLE IF NOT EXISTS entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_entrada DATE NOT NULL,
  produtor_id UUID REFERENCES produtores(id) ON DELETE SET NULL,
  variedade_id UUID REFERENCES variedades(id) ON DELETE SET NULL,
  classificacao TEXT CHECK (classificacao IN ('CAT1', 'CAT2', 'CAT3')),
  caixas INTEGER NOT NULL,
  preco_compra NUMERIC NOT NULL,
  total NUMERIC GENERATED ALWAYS AS (caixas * preco_compra) STORED,
  status TEXT DEFAULT 'concluido' CHECK (status IN ('concluido', 'pendente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ESTOQUE
CREATE TABLE IF NOT EXISTS estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_estoque DATE NOT NULL,
  data_entrada DATE NOT NULL,
  numero_palete TEXT UNIQUE NOT NULL,
  descricao TEXT,
  caixas INTEGER,
  peso_caixa NUMERIC,
  peso_total_kg NUMERIC GENERATED ALWAYS AS (caixas * peso_caixa) STORED,
  mascaro TEXT,
  variedade_id UUID REFERENCES variedades(id) ON DELETE SET NULL,
  produtor_id UUID REFERENCES produtores(id) ON DELETE SET NULL,
  classificacao TEXT CHECK (classificacao IN ('CAT1', 'CAT2', 'CAT3')),
  embalagem TEXT,
  marca TEXT,
  armazem_id UUID REFERENCES armazens(id) ON DELETE SET NULL,
  dias_frio INTEGER,
  mercado TEXT,
  status TEXT DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'expedido')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ROMANEIOS
CREATE TABLE IF NOT EXISTS romaneios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  data_saida DATE NOT NULL,
  valor_venda NUMERIC,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ROMANEIO ITENS
CREATE TABLE IF NOT EXISTS romaneio_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  romaneio_id UUID REFERENCES romaneios(id) ON DELETE CASCADE,
  palete_id UUID REFERENCES estoque(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- EXPEDICAO
CREATE TABLE IF NOT EXISTS expedicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  romaneio_id UUID REFERENCES romaneios(id) ON DELETE SET NULL,
  palete_id UUID REFERENCES estoque(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  data_saida DATE,
  preco_compra NUMERIC,
  valor_venda NUMERIC,
  status TEXT DEFAULT 'expedido',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE variedades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE armazens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque           ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_itens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedicao         ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write all tables
CREATE POLICY "auth_all" ON profiles         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON produtores        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON variedades        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON armazens          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON clientes          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON entradas          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON estoque           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON romaneios         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON romaneio_itens    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON expedicao         FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Variedades
INSERT INTO variedades (nome, tipo, cor, categoria) VALUES
  ('Thompson Seedless', 'Sem Semente', 'Verde', 'Exportação'),
  ('Crimson', 'Sem Semente', 'Vermelha', 'Exportação'),
  ('Itália', 'Com Semente', 'Verde-Amarela', 'Mercado Interno'),
  ('Sugraone', 'Sem Semente', 'Verde', 'Exportação')
ON CONFLICT DO NOTHING;

-- Armazéns
INSERT INTO armazens (nome, cidade, capacidade_tons, tipo) VALUES
  ('Câmara Fria A', 'Petrolina', 600, 'Câmara Fria'),
  ('Câmara Fria B', 'Petrolina', 500, 'Câmara Fria'),
  ('Estoque Seco', 'Juazeiro', 500, 'Estoque Seco')
ON CONFLICT DO NOTHING;

-- Produtores
INSERT INTO produtores (nome, cpf_cnpj, telefone, cidade, estado, status) VALUES
  ('Fazenda Sol Nascente', '12.345.678/0001-99', '(87) 99999-1111', 'Petrolina', 'PE', 'ativo'),
  ('Cooperativa Vale Verde', '98.765.432/0001-55', '(87) 98888-2222', 'Juazeiro', 'BA', 'ativo'),
  ('Sítio Alvorada', '11.222.333/0001-44', '(81) 97777-3333', 'Santa Maria da Boa Vista', 'PE', 'ativo')
ON CONFLICT DO NOTHING;

-- Clientes
INSERT INTO clientes (nome, cpf_cnpj, telefone, cidade, limite_credito, status) VALUES
  ('Super Frutas Ltda', '55.666.777/0001-88', '(11) 3333-4444', 'São Paulo', 150000, 'ativo'),
  ('Mercado Bom Preço', '99.888.777/0001-66', '(21) 2222-5555', 'Rio de Janeiro', 80000, 'ativo')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Entradas (requires actual UUID matches)
-- Run after above inserts — get the IDs from the tables
-- and replace the UUIDs in the inserts below, OR
-- use this approach with subqueries:
-- ============================================================
INSERT INTO entradas (data_entrada, produtor_id, variedade_id, classificacao, caixas, preco_compra, status)
SELECT 
  CURRENT_DATE - INTERVAL '5 days',
  p.id, v.id, 'CAT1', 150, 45.00, 'concluido'
FROM produtores p, variedades v
WHERE p.nome = 'Fazenda Sol Nascente' AND v.nome = 'Thompson Seedless'
LIMIT 1;

INSERT INTO entradas (data_entrada, produtor_id, variedade_id, classificacao, caixas, preco_compra, status)
SELECT 
  CURRENT_DATE - INTERVAL '10 days',
  p.id, v.id, 'CAT2', 200, 38.50, 'concluido'
FROM produtores p, variedades v
WHERE p.nome = 'Cooperativa Vale Verde' AND v.nome = 'Crimson'
LIMIT 1;

INSERT INTO entradas (data_entrada, produtor_id, variedade_id, classificacao, caixas, preco_compra, status)
SELECT 
  CURRENT_DATE - INTERVAL '3 days',
  p.id, v.id, 'CAT1', 80, 55.00, 'concluido'
FROM produtores p, variedades v
WHERE p.nome = 'Sítio Alvorada' AND v.nome = 'Itália'
LIMIT 1;

INSERT INTO entradas (data_entrada, produtor_id, variedade_id, classificacao, caixas, preco_compra, status)
SELECT 
  CURRENT_DATE - INTERVAL '15 days',
  p.id, v.id, 'CAT3', 300, 28.00, 'pendente'
FROM produtores p, variedades v
WHERE p.nome = 'Fazenda Sol Nascente' AND v.nome = 'Sugraone'
LIMIT 1;

INSERT INTO entradas (data_entrada, produtor_id, variedade_id, classificacao, caixas, preco_compra, status)
SELECT 
  CURRENT_DATE - INTERVAL '2 days',
  p.id, v.id, 'CAT1', 120, 48.00, 'concluido'
FROM produtores p, variedades v
WHERE p.nome = 'Cooperativa Vale Verde' AND v.nome = 'Thompson Seedless'
LIMIT 1;

-- ============================================================
-- SEED: Estoque Paletes
-- ============================================================
DO $$
DECLARE
  v_thompson UUID;
  v_crimson UUID;
  v_italia UUID;
  v_sugraone UUID;
  p_sol UUID;
  p_vale UUID;
  p_sitio UUID;
  a_fria_a UUID;
  a_fria_b UUID;
  a_seco UUID;
BEGIN
  SELECT id INTO v_thompson FROM variedades WHERE nome = 'Thompson Seedless' LIMIT 1;
  SELECT id INTO v_crimson FROM variedades WHERE nome = 'Crimson' LIMIT 1;
  SELECT id INTO v_italia FROM variedades WHERE nome = 'Itália' LIMIT 1;
  SELECT id INTO v_sugraone FROM variedades WHERE nome = 'Sugraone' LIMIT 1;
  SELECT id INTO p_sol FROM produtores WHERE nome = 'Fazenda Sol Nascente' LIMIT 1;
  SELECT id INTO p_vale FROM produtores WHERE nome = 'Cooperativa Vale Verde' LIMIT 1;
  SELECT id INTO p_sitio FROM produtores WHERE nome = 'Sítio Alvorada' LIMIT 1;
  SELECT id INTO a_fria_a FROM armazens WHERE nome = 'Câmara Fria A' LIMIT 1;
  SELECT id INTO a_fria_b FROM armazens WHERE nome = 'Câmara Fria B' LIMIT 1;
  SELECT id INTO a_seco FROM armazens WHERE nome = 'Estoque Seco' LIMIT 1;

  INSERT INTO estoque (data_estoque, data_entrada, numero_palete, descricao, caixas, peso_caixa, mascaro, variedade_id, produtor_id, classificacao, embalagem, marca, armazem_id, status) VALUES
  (CURRENT_DATE - 2, CURRENT_DATE - 5, 'PLT-001', 'Lote A - Thompson Verde', 48, 8.5, 'Uniforme Verde', v_thompson, p_sol, 'CAT1', 'Caixa 8kg', 'SolFresh', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 3, CURRENT_DATE - 7, 'PLT-002', 'Lote A - Thompson Verde', 48, 8.5, 'Uniforme Verde', v_thompson, p_sol, 'CAT1', 'Caixa 8kg', 'SolFresh', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 4, CURRENT_DATE - 10, 'PLT-003', 'Lote B - Crimson', 40, 8.0, 'Uniforme Vermelha', v_crimson, p_vale, 'CAT2', 'Caixa 8kg', 'ValeGrape', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 5, CURRENT_DATE - 12, 'PLT-004', 'Lote B - Crimson', 40, 8.0, 'Manchas leves', v_crimson, p_vale, 'CAT2', 'Caixa 8kg', 'ValeGrape', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 1, CURRENT_DATE - 3, 'PLT-005', 'Lote C - Itália', 50, 9.0, 'Cacho Grande', v_italia, p_sitio, 'CAT1', 'Caixa 9kg', 'AlvoradaFruits', a_fria_b, 'disponivel'),
  (CURRENT_DATE - 2, CURRENT_DATE - 8, 'PLT-006', 'Lote C - Itália', 50, 9.0, 'Cacho Médio', v_italia, p_sitio, 'CAT1', 'Caixa 9kg', 'AlvoradaFruits', a_fria_b, 'disponivel'),
  (CURRENT_DATE - 6, CURRENT_DATE - 15, 'PLT-007', 'Lote D - Sugraone', 60, 8.2, 'Verde Intenso', v_sugraone, p_sol, 'CAT3', 'Caixa 8kg', 'SolFresh', a_seco, 'disponivel'),
  (CURRENT_DATE - 7, CURRENT_DATE - 20, 'PLT-008', 'Lote D - Sugraone', 60, 8.2, 'Verde Intenso', v_sugraone, p_sol, 'CAT3', 'Caixa 8kg', 'SolFresh', a_seco, 'disponivel'),
  (CURRENT_DATE - 10, CURRENT_DATE - 35, 'PLT-009', 'Lote E - Thompson Antigo', 48, 8.5, 'Levemente Amarelada', v_thompson, p_vale, 'CAT2', 'Caixa 8kg', 'ValeGrape', a_fria_b, 'disponivel'),
  (CURRENT_DATE - 12, CURRENT_DATE - 40, 'PLT-010', 'Lote F - Crimson Antigo', 40, 8.0, 'Manchas moderadas', v_crimson, p_sol, 'CAT3', 'Caixa 8kg', 'SolFresh', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 1, CURRENT_DATE - 2, 'PLT-011', 'Lote G - Thompson Fresco', 48, 8.5, 'Uniforme Verde', v_thompson, p_sitio, 'CAT1', 'Caixa 8kg', 'AlvoradaFruits', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 2, CURRENT_DATE - 4, 'PLT-012', 'Lote H - Itália Premium', 50, 9.0, 'Cacho Extra Grande', v_italia, p_sitio, 'CAT1', 'Caixa 9kg', 'AlvoradaFruits', a_fria_b, 'disponivel'),
  (CURRENT_DATE - 3, CURRENT_DATE - 6, 'PLT-013', 'Lote I - Crimson Premium', 40, 8.0, 'Uniforme Vermelha', v_crimson, p_vale, 'CAT1', 'Caixa 8kg', 'ValeGrape', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 4, CURRENT_DATE - 9, 'PLT-014', 'Lote J - Sugraone Fresh', 60, 8.2, 'Verde Brilhante', v_sugraone, p_sol, 'CAT1', 'Caixa 8kg', 'SolFresh', a_fria_b, 'disponivel'),
  (CURRENT_DATE - 5, CURRENT_DATE - 11, 'PLT-015', 'Lote K - Thompson CAT2', 48, 8.5, 'Algumas manchas', v_thompson, p_vale, 'CAT2', 'Caixa 8kg', 'ValeGrape', a_seco, 'disponivel'),
  (CURRENT_DATE - 6, CURRENT_DATE - 13, 'PLT-016', 'Lote L - Itália CAT2', 50, 9.0, 'Cacho Médio-Grande', v_italia, p_sitio, 'CAT2', 'Caixa 9kg', 'AlvoradaFruits', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 15, CURRENT_DATE - 38, 'PLT-017', 'Lote M - Antigo+', 48, 8.5, 'Cor Amarelada', v_thompson, p_sol, 'CAT3', 'Caixa 8kg', 'SolFresh', a_seco, 'disponivel'),
  (CURRENT_DATE - 2, CURRENT_DATE - 5, 'PLT-018', 'Lote N - Crimson Fresh', 40, 8.0, 'Uniforme Vermelha', v_crimson, p_vale, 'CAT1', 'Caixa 8kg', 'ValeGrape', a_fria_b, 'disponivel'),
  (CURRENT_DATE - 1, CURRENT_DATE - 3, 'PLT-019', 'Lote O - Sugraone Premium', 60, 8.2, 'Verde Extra', v_sugraone, p_sitio, 'CAT1', 'Caixa 8kg', 'AlvoradaFruits', a_fria_a, 'disponivel'),
  (CURRENT_DATE - 3, CURRENT_DATE - 7, 'PLT-020', 'Lote P - Itália Standard', 50, 9.0, 'Cacho Médio', v_italia, p_sol, 'CAT2', 'Caixa 9kg', 'SolFresh', a_fria_b, 'disponivel');
END $$;

-- ============================================================
-- HOW TO CREATE USERS
-- ============================================================
-- In Supabase Dashboard → Authentication → Users → Create User
-- After creating a user, run:
-- UPDATE profiles SET nome = 'Nome do Usuário', role = 'dono' WHERE id = '<USER_UUID>';
-- 
-- Roles: 'dono' | 'operador' | 'vendedor'
-- ============================================================
