// Unidades da federação, capitais e o fuso IANA de cada capital.
// O Amazonas tem municípios em dois fusos e o Pará tem um só; aqui vale o da
// capital. Os fusos do Brasil sem horário de verão desde 2019 (Decreto nº 9.772/2019).
export const UFS = [
  { sigla: "AC", nome: "Acre", capital: "Rio Branco", fuso: "America/Rio_Branco" },
  { sigla: "AL", nome: "Alagoas", capital: "Maceió", fuso: "America/Maceio" },
  { sigla: "AP", nome: "Amapá", capital: "Macapá", fuso: "America/Belem" },
  { sigla: "AM", nome: "Amazonas", capital: "Manaus", fuso: "America/Manaus" },
  { sigla: "BA", nome: "Bahia", capital: "Salvador", fuso: "America/Bahia" },
  { sigla: "CE", nome: "Ceará", capital: "Fortaleza", fuso: "America/Fortaleza" },
  { sigla: "DF", nome: "Distrito Federal", capital: "Brasília", fuso: "America/Sao_Paulo" },
  { sigla: "ES", nome: "Espírito Santo", capital: "Vitória", fuso: "America/Sao_Paulo" },
  { sigla: "GO", nome: "Goiás", capital: "Goiânia", fuso: "America/Sao_Paulo" },
  { sigla: "MA", nome: "Maranhão", capital: "São Luís", fuso: "America/Fortaleza" },
  { sigla: "MT", nome: "Mato Grosso", capital: "Cuiabá", fuso: "America/Cuiaba" },
  { sigla: "MS", nome: "Mato Grosso do Sul", capital: "Campo Grande", fuso: "America/Campo_Grande" },
  { sigla: "MG", nome: "Minas Gerais", capital: "Belo Horizonte", fuso: "America/Sao_Paulo" },
  { sigla: "PA", nome: "Pará", capital: "Belém", fuso: "America/Belem" },
  { sigla: "PB", nome: "Paraíba", capital: "João Pessoa", fuso: "America/Fortaleza" },
  { sigla: "PR", nome: "Paraná", capital: "Curitiba", fuso: "America/Sao_Paulo" },
  { sigla: "PE", nome: "Pernambuco", capital: "Recife", fuso: "America/Recife" },
  { sigla: "PI", nome: "Piauí", capital: "Teresina", fuso: "America/Fortaleza" },
  { sigla: "RJ", nome: "Rio de Janeiro", capital: "Rio de Janeiro", fuso: "America/Sao_Paulo" },
  { sigla: "RN", nome: "Rio Grande do Norte", capital: "Natal", fuso: "America/Fortaleza" },
  { sigla: "RS", nome: "Rio Grande do Sul", capital: "Porto Alegre", fuso: "America/Sao_Paulo" },
  { sigla: "RO", nome: "Rondônia", capital: "Porto Velho", fuso: "America/Porto_Velho" },
  { sigla: "RR", nome: "Roraima", capital: "Boa Vista", fuso: "America/Boa_Vista" },
  { sigla: "SC", nome: "Santa Catarina", capital: "Florianópolis", fuso: "America/Sao_Paulo" },
  { sigla: "SP", nome: "São Paulo", capital: "São Paulo", fuso: "America/Sao_Paulo" },
  { sigla: "SE", nome: "Sergipe", capital: "Aracaju", fuso: "America/Maceio" },
  { sigla: "TO", nome: "Tocantins", capital: "Palmas", fuso: "America/Araguaina" },
];

export function buscarUf(sigla) {
  return UFS.find((uf) => uf.sigla === sigla) ?? null;
}
