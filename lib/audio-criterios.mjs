export const CRITERIOS_AUDIO=[
 ['diccao','Dicção',10,[['Excelente',100],['Boa',80],['Regular',60],['Ruim',20]]],
 ['velocidade','Velocidade',8,[['Ideal',100],['Rápida demais',60],['Lenta demais',60]]],
 ['entonacao','Entonação',10,[['Excelente',100],['Boa',80],['Fraca',40]]],
 ['seguranca','Segurança',15,[['Muito seguro',100],['Médio',70],['Baixo',30]]],
 ['naturalidade','Naturalidade',10,[['Natural',100],['Levemente engessado',70],['Robótico',30]]],
 ['clareza','Clareza',15,[['Muito claro',100],['Médio',70],['Confuso',30]]],
 ['postura','Postura',10,[['Excelente',100],['Adequado',80],['Inadequado',20]]],
 ['energia','Energia',7,[['Presente',100],['Neutro',70],['Ausente',30]]],
 ['conducao','Condução',10,[['Conduz bem',100],['Médio',70],['Passivo/perdido',30]]],
 ['script','Script',5,[['Seguiu bem',100],['Adaptou bem',85],['Fugiu do objetivo',30]]]
];
export function notaAudio(criterios){
 if(!criterios||Array.isArray(criterios)||Object.keys(criterios).length!==10)throw new Error('Preencha os dez critérios.');
 return Math.round(CRITERIOS_AUDIO.reduce((n,[k,,peso,ops])=>{
 if(!ops.some(([,v])=>v===criterios[k]))throw new Error('Opção de áudio inválida.');return n+criterios[k]*peso/100;
 },0));
}
