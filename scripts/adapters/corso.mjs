import { assignIcon, classifyProduct, fetchWithRetry, slug, validateOffer } from "./common.mjs";

const CORSO_URL = "https://corso.com.br/jornalfrente.php";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

export async function extractCorso(customUrl = null) {
  const pageUrl = customUrl || CORSO_URL;
  const res = await fetchWithRetry(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Corso flyer page (${res.status})`);
  const html = await res.text();

  // Extract hash timestamp to detect image flyer updates
  const hashMatch = html.match(/jornal-frente\.jpg\?hash=(\d+)/);
  const hash = hashMatch ? hashMatch[1] : "default";

  // Validity dates for current flyer: 16 to 22 October 2026
  const validity = { from: "2026-10-16", to: "2026-10-22" };

  const rawOffers = [
    // Hortifruti
    { name: "Alface", brand: "", detail: "Unidade", cat: "Hortifruti", price: 4.18, oldPrice: 5.18 },
    { name: "Brócolis Japonês", brand: "", detail: "Unidade", cat: "Hortifruti", price: 6.48, oldPrice: 7.88 },
    { name: "Repolho Verde", brand: "", detail: "Kg", cat: "Hortifruti", price: 1.58, oldPrice: 1.98 },
    { name: "Milho Verde Bandeja", brand: "", detail: "Bandeja", cat: "Hortifruti", price: 4.88, oldPrice: 5.88 },
    { name: "Alho Graúdo a Granel", brand: "", detail: "A cada 100g", cat: "Hortifruti", price: 2.49, oldPrice: 2.69 },
    { name: "Batata Escovada", brand: "", detail: "Kg", cat: "Hortifruti", price: 4.28, oldPrice: 5.28 },
    { name: "Batata Lavada", brand: "", detail: "Kg", cat: "Hortifruti", price: 4.58, oldPrice: 5.58 },
    { name: "Beterraba", brand: "", detail: "Kg", cat: "Hortifruti", price: 2.48, oldPrice: 2.98 },
    { name: "Cebola", brand: "", detail: "Kg", cat: "Hortifruti", price: 5.48, oldPrice: 6.58 },
    { name: "Cenoura", brand: "", detail: "Kg", cat: "Hortifruti", price: 3.58, oldPrice: 4.28 },
    { name: "Chuchu", brand: "", detail: "Kg", cat: "Hortifruti", price: 2.98, oldPrice: 3.58 },
    { name: "Pepino Caipira", brand: "", detail: "Kg", cat: "Hortifruti", price: 4.18, oldPrice: 5.18 },
    { name: "Tomate", brand: "", detail: "Kg", cat: "Hortifruti", price: 9.48, oldPrice: 11.98 },
    { name: "Tomate Grape", brand: "", detail: "300g", cat: "Hortifruti", price: 3.88, oldPrice: 4.88 },
    { name: "Abacate", brand: "", detail: "Kg", cat: "Hortifruti", price: 5.28, oldPrice: 6.28 },
    { name: "Abacaxi", brand: "", detail: "Unidade", cat: "Hortifruti", price: 7.98, oldPrice: 9.98 },
    { name: "Banana Nanica", brand: "", detail: "Kg", cat: "Hortifruti", price: 3.58, oldPrice: 4.98 },
    { name: "Banana Prata", brand: "", detail: "Kg", cat: "Hortifruti", price: 6.38, oldPrice: 8.58 },
    { name: "Laranja a Granel", brand: "", detail: "Kg", cat: "Hortifruti", price: 2.48, oldPrice: 2.98 },
    { name: "Limão Taiti", brand: "", detail: "Kg", cat: "Hortifruti", price: 10.78, oldPrice: 12.98 },
    { name: "Maçã Gala", brand: "", detail: "Kg", cat: "Hortifruti", price: 7.88, oldPrice: 9.88 },
    { name: "Mamão Formosa", brand: "", detail: "Kg", cat: "Hortifruti", price: 4.18, oldPrice: 5.18 },
    { name: "Mamão Papaya", brand: "", detail: "Unidade", cat: "Hortifruti", price: 4.98, oldPrice: 6.18 },
    { name: "Manga", brand: "", detail: "Kg", cat: "Hortifruti", price: 5.38, oldPrice: 6.98 },
    { name: "Melancia", brand: "", detail: "Kg", cat: "Hortifruti", price: 2.98, oldPrice: 3.68 },

    // Carnes e Frios
    { name: "Carne Moída Congelada", brand: "Brasa", detail: "500g", cat: "Carnes", price: 17.98, oldPrice: null },
    { name: "Lagarto Bovino Fatiado Congelado", brand: "", detail: "Kg", cat: "Carnes", price: 38.90, oldPrice: null },
    { name: "Cupim Bovino Peça/Pedaço", brand: "", detail: "Kg", cat: "Carnes", price: 40.90, oldPrice: null },
    { name: "Língua Bovina Congelada", brand: "", detail: "Kg", cat: "Carnes", price: 17.90, oldPrice: null },
    { name: "Coxa e Sobrecoxa de Frango Congelada", brand: "Nutribem", detail: "Kg", cat: "Carnes", price: 8.98, oldPrice: null },
    { name: "Frango Congelado", brand: "Nutribem", detail: "Kg", cat: "Carnes", price: 8.78, oldPrice: null },
    { name: "Carne Moída de Frango Congelada", brand: "Nutribem", detail: "500g", cat: "Carnes", price: 7.98, oldPrice: null },
    { name: "Frango a Passarinho Temperado Congelado", brand: "Nutribem", detail: "1Kg", cat: "Carnes", price: 9.98, oldPrice: null },
    { name: "Peito de Frango com Osso Congelado", brand: "Nutribem", detail: "Kg", cat: "Carnes", price: 11.98, oldPrice: null },
    { name: "Peito de Frango sem Osso Congelado", brand: "Gonzalez", detail: "Kg", cat: "Carnes", price: 18.48, oldPrice: null },
    { name: "Filézinho Sassami IQF Congelado", brand: "Aurora", detail: "1Kg", cat: "Carnes", price: 19.98, oldPrice: null },
    { name: "Sobrecoxa de Frango IQF Congelada", brand: "Seara", detail: "1Kg", cat: "Carnes", price: 15.28, oldPrice: null },
    { name: "Coxinha da Asa de Frango IQF Congelada", brand: "Seara", detail: "1Kg", cat: "Carnes", price: 15.68, oldPrice: null },
    { name: "Steak de Frango Congelado", brand: "Seara", detail: "100g", cat: "Carnes", price: 2.10, oldPrice: null },
    { name: "Hambúrguer Misto Congelado", brand: "Brasa", detail: "56g", cat: "Carnes", price: 1.38, oldPrice: null },
    { name: "Linguiça Calabresa Resfriada", brand: "Brasa", detail: "Kg", cat: "Carnes", price: 24.40, oldPrice: null },
    { name: "Linguiça de Pernil Fina Resfriada", brand: "Suíba", detail: "Kg", cat: "Carnes", price: 25.80, oldPrice: null },
    { name: "Linguiça de Frango Congelada", brand: "Gonzalez", detail: "1Kg", cat: "Carnes", price: 13.30, oldPrice: null },
    { name: "Linguiça Toscana Congelada", brand: "Aurora", detail: "700g", cat: "Carnes", price: 17.50, oldPrice: null },
    { name: "Filé de Merluza Congelado", brand: "Megg's", detail: "800g", cat: "Peixes", price: 33.80, oldPrice: null },
    { name: "Ervilha Congelada", brand: "Seara", detail: "300g", cat: "Congelados", price: 5.98, oldPrice: null },
    { name: "Lasanha Congelada", brand: "Flip", detail: "600g", cat: "Congelados", price: 9.38, oldPrice: null },
    { name: "Massa para Pastel Disco", brand: "S&A", detail: "500g", cat: "Mercearia", price: 8.58, oldPrice: null },

    // Laticínios e Padaria
    { name: "Bebida Láctea com Polpa", brand: "Argenzio", detail: "1L", cat: "Laticínios", price: 5.58, oldPrice: null },
    { name: "Cobertura Cremosa Sabor Requeijão", brand: "Sul Minas", detail: "200g", cat: "Laticínios", price: 5.18, oldPrice: null },
    { name: "Manteiga Extra", brand: "Argenzio", detail: "200g", cat: "Laticínios", price: 9.28, oldPrice: null },
    { name: "Pão de Queijo Tradicional Congelado", brand: "Tati Minas", detail: "400g", cat: "Congelados", price: 7.78, oldPrice: null },
    { name: "Pão Francês", brand: "", detail: "Kg", cat: "Padaria", price: 14.98, oldPrice: null },
    { name: "Pão de Forma Tradicional", brand: "Visconti", detail: "400g", cat: "Padaria", price: 5.18, oldPrice: null },
    { name: "Torrada Tradicional", brand: "Adria", detail: "142g", cat: "Mercearia", price: 4.18, oldPrice: null },
    { name: "Leite Longa Vida Integral", brand: "Tirol", detail: "1L", cat: "Laticínios", price: 4.88, oldPrice: null },
    { name: "Leite Condensado TP", brand: "Cemil", detail: "395g", cat: "Laticínios", price: 5.98, oldPrice: null },
    { name: "Creme de Leite TP", brand: "Quatá", detail: "200g", cat: "Laticínios", price: 2.18, oldPrice: null },

    // Mercearia e Básicos
    { name: "Arroz Tipo 1", brand: "Albarus", detail: "5kg", cat: "Mercearia", price: 27.98, oldPrice: null },
    { name: "Arroz Tipo 1", brand: "Du Dé", detail: "5kg", cat: "Mercearia", price: 18.98, oldPrice: null },
    { name: "Feijão Carioca", brand: "Du Dé", detail: "1kg", cat: "Mercearia", price: 6.78, oldPrice: null },
    { name: "Café Almofada", brand: "Pacaembu", detail: "500g", cat: "Mercearia", price: 17.98, oldPrice: null },
    { name: "Açúcar Cristal", brand: "Purinha", detail: "2kg", cat: "Mercearia", price: 5.58, oldPrice: null },
    { name: "Óleo de Soja Pet", brand: "Vitaliv", detail: "900ml", cat: "Mercearia", price: 6.98, oldPrice: null },
    { name: "Molho de Tomate Tradicional Sachê", brand: "Predilecta", detail: "300g", cat: "Mercearia", price: 1.28, oldPrice: null },
    { name: "Biscoito Maizena", brand: "Triunfo", detail: "345g", cat: "Mercearia", price: 3.98, oldPrice: null },
    { name: "Massa para Tapioca", brand: "Amafil", detail: "500g", cat: "Mercearia", price: 4.78, oldPrice: null },
    { name: "Farinha de Milho", brand: "Jimbelê", detail: "400g", cat: "Mercearia", price: 3.38, oldPrice: null },
    { name: "Pipoca Gold", brand: "Kinino", detail: "400g", cat: "Mercearia", price: 4.18, oldPrice: null },
    { name: "Tempero Prático Sabor", brand: "Kinino", detail: "40g", cat: "Mercearia", price: 2.98, oldPrice: null },
    { name: "Atum Ralado", brand: "Gomes da Costa", detail: "170g", cat: "Mercearia", price: 8.78, oldPrice: null },
    { name: "Sardinha em Óleo", brand: "Gomes da Costa", detail: "125g", cat: "Mercearia", price: 6.24, oldPrice: null },
    { name: "Azeitona Verde Fatiada Sachet", brand: "Diza", detail: "100g", cat: "Mercearia", price: 5.58, oldPrice: null },
    { name: "Palmito Inteiro", brand: "Riviera", detail: "300g", cat: "Mercearia", price: 19.90, oldPrice: null },
    { name: "Milho Verde Sachet", brand: "Fugini", detail: "170g", cat: "Mercearia", price: 3.28, oldPrice: null },
    { name: "Seleta de Legumes Lata", brand: "Predilecta", detail: "170g", cat: "Mercearia", price: 3.98, oldPrice: null },
    { name: "Macarrão Instantâneo", brand: "Renata", detail: "85g", cat: "Mercearia", price: 1.58, oldPrice: null },
    { name: "Batata Palha", brand: "São José", detail: "110g", cat: "Mercearia", price: 5.78, oldPrice: null },
    { name: "Salgadinho Torcida Sabores", brand: "Torcida", detail: "100g", cat: "Mercearia", price: 3.38, oldPrice: null },
    { name: "Biscoito Wafer", brand: "Itamaraty", detail: "80g", cat: "Mercearia", price: 2.24, oldPrice: null },
    { name: "Gelatina Sabores", brand: "Kinino", detail: "20g", cat: "Mercearia", price: 0.99, oldPrice: null },
    { name: "Doce de Goiabada Bloco", brand: "Predilecta", detail: "500g", cat: "Mercearia", price: 7.78, oldPrice: null },
    { name: "Aveia em Flocos", brand: "K-life", detail: "170g", cat: "Mercearia", price: 3.48, oldPrice: null },
    { name: "Bebida Láctea Chocolate", brand: "Mocoquinha", detail: "200ml", cat: "Laticínios", price: 1.24, oldPrice: null },
    { name: "Bolinho Divertix", brand: "Renata", detail: "40g", cat: "Mercearia", price: 1.48, oldPrice: null },

    // Bebidas
    { name: "Refrigerante Menos Açúcar Pet", brand: "Coca-Cola", detail: "2,5L", cat: "Bebidas", price: 8.68, oldPrice: null },
    { name: "Refrigerante Guaraná Pet", brand: "Cruzeiro", detail: "2L", cat: "Bebidas", price: 5.18, oldPrice: null },
    { name: "Água Mineral com Gás", brand: "Crystal", detail: "500ml", cat: "Bebidas", price: 1.88, oldPrice: null },
    { name: "Suco de Frutas", brand: "Dafruta", detail: "1L", cat: "Bebidas", price: 4.98, oldPrice: null },
    { name: "Suco Caju", brand: "Maguary", detail: "500ml", cat: "Bebidas", price: 4.38, oldPrice: null },
    { name: "Suco Infantil Kapo", brand: "Del Valle", detail: "200ml", cat: "Bebidas", price: 2.10, oldPrice: null },

    // Limpeza e Higiene
    { name: "Sabão em Pó Lavagem Perfeita", brand: "OMO", detail: "800g", cat: "Limpeza", price: 10.98, oldPrice: null },
    { name: "Sabão em Pó Triplação", brand: "Assim", detail: "800g", cat: "Limpeza", price: 6.78, oldPrice: null },
    { name: "Detergente Clear", brand: "Ypê", detail: "500ml", cat: "Limpeza", price: 2.18, oldPrice: null },
    { name: "Amaciante Concentrado", brand: "Comfort", detail: "500ml", cat: "Limpeza", price: 10.95, oldPrice: null },
    { name: "Amaciante de Roupas", brand: "Triex", detail: "2L", cat: "Limpeza", price: 6.28, oldPrice: null },
    { name: "Água Sanitária", brand: "Triex", detail: "2L", cat: "Limpeza", price: 5.58, oldPrice: null },
    { name: "Desinfetante", brand: "Triex", detail: "2L", cat: "Limpeza", price: 5.48, oldPrice: null },
    { name: "Limpador Multi-Uso", brand: "Triex", detail: "500ml", cat: "Limpeza", price: 3.08, oldPrice: null },
    { name: "Álcool Antibacteriano 46 Inpm", brand: "Safra", detail: "1L", cat: "Limpeza", price: 8.48, oldPrice: null },
    { name: "Inseticida Multi Aero", brand: "SBP", detail: "450ml", cat: "Limpeza", price: 20.68, oldPrice: null },
    { name: "Lã de Aço", brand: "Bombril", detail: "45g", cat: "Limpeza", price: 2.68, oldPrice: null },
    { name: "Saco para Lixo", brand: "Fortão", detail: "10x50L / 5x100L", cat: "Limpeza", price: 6.58, oldPrice: null },
    { name: "Papel Higiênico Folha Dupla Absolute 30m", brand: "Fofinho", detail: "Leve 12 Pague 11", cat: "Limpeza", price: 18.90, oldPrice: null },
    { name: "Papel Higiênico Branco", brand: "Paloma", detail: "8 rolos", cat: "Limpeza", price: 7.96, oldPrice: null },
    { name: "Toalha de Papel Branca", brand: "Maxim", detail: "2 unidades", cat: "Limpeza", price: 5.28, oldPrice: null },
    { name: "Guardanapo Branco 23x22cm", brand: "Maxim", detail: "50 unidades", cat: "Limpeza", price: 1.98, oldPrice: null },
    { name: "Aparelho de Barbear Ultragrip", brand: "Prestobarba", detail: "2 unidades", cat: "Higiene", price: 5.98, oldPrice: null },
    { name: "Absorvente Cobertura Suave c/ Abas", brand: "Sym", detail: "8 unidades", cat: "Higiene", price: 3.98, oldPrice: null },
    { name: "Toalha Umedecida", brand: "Tropolino", detail: "Leve 120un Pague 100un", cat: "Higiene", price: 9.98, oldPrice: null },
    { name: "Antisséptico Bucal", brand: "Cepacol", detail: "Leve 500ml Pague 350ml", cat: "Higiene", price: 13.58, oldPrice: null },
    { name: "Sabonete em Barra", brand: "Phebo", detail: "90g", cat: "Higiene", price: 5.28, oldPrice: null },
    { name: "Sabonete em Barra", brand: "Albany", detail: "85g", cat: "Higiene", price: 1.78, oldPrice: null },
    { name: "Shampoo", brand: "Pantene", detail: "175ml / 200ml", cat: "Higiene", price: 14.98, oldPrice: null },
    { name: "Shampoo", brand: "Seda", detail: "300ml / 325ml", cat: "Higiene", price: 10.78, oldPrice: null },
    { name: "Desodorante Aero", brand: "Bozzano / Monange", detail: "150ml", cat: "Higiene", price: 8.90, oldPrice: null },

    // Casa e Pet
    { name: "Filtro de Papel 103", brand: "Melitta", detail: "30 unidades", cat: "Casa", price: 4.88, oldPrice: null },
    { name: "Filme de PVC", brand: "Wyda", detail: "28cm x 15m", cat: "Casa", price: 6.58, oldPrice: null },
    { name: "Copo Americano", brand: "Nadir", detail: "190ml", cat: "Casa", price: 1.38, oldPrice: null },
    { name: "Ração para Cães Adultos", brand: "Yuppie", detail: "2Kg", cat: "Pet", price: 18.90, oldPrice: null },
    { name: "Ração para Gatos Adultos", brand: "Yuppie", detail: "1Kg", cat: "Pet", price: 12.90, oldPrice: null },
  ];

  const offers = [];

  for (const item of rawOffers) {
    const taxonomy = classifyProduct(item.name, item.brand, item.cat, item.cat);
    const icon = assignIcon(item.name, taxonomy.productType, taxonomy.department);

    const offer = {
      id: `corso-${slug(`${item.name}-${item.brand}-${item.detail}-${validity.from}`)}`,
      store: "Supermercado Corso",
      storeLogo: "https://corso.com.br/img/logo.png",
      branch: "Rua Eduardo Lopes Castilho, 495 · São João",
      name: item.name,
      brand: item.brand,
      detail: item.detail,
      category: taxonomy.department,
      department: taxonomy.department,
      productType: taxonomy.productType,
      productTypes: taxonomy.productTypes,
      storeCategory: item.cat,
      price: item.price,
      previousPrice: item.oldPrice,
      icon,
      tone: "#edf4e9",
      note: "",
      validFrom: validity.from,
      validTo: validity.to,
      source: "Folheto oficial · São João da Boa Vista",
      sourceUrl: pageUrl,
    };

    if (validateOffer(offer)) {
      offers.push(offer);
    }
  }

  return {
    storeId: "corso",
    store: {
      name: "Supermercado Corso",
      branch: "Rua Eduardo Lopes Castilho, 495 · São João",
      logo: "https://corso.com.br/img/logo.png",
      source: "Folheto oficial · São João da Boa Vista",
      sourceUrl: pageUrl,
      from: validity.from,
      to: validity.to,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    flyerHash: hash,
    offers,
    status: "ok",
  };
}
