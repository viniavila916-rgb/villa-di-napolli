/**
 * AGENDAMENTOS NO GOOGLE PLANILHAS, ATUALIZADOS SOZINHOS
 * ------------------------------------------------------------
 * Cole este código em: Extensões > Apps Script (dentro da planilha).
 * Troque as duas linhas abaixo, salve e rode "ligarAtualizacaoAutomatica".
 * A aba "Agendamentos" é reescrita por inteiro a cada atualização:
 * faça suas anotações em OUTRA aba.
 */
const ENDERECO = "https://SEU-SITE/api/planilha?chave=SUA-CHAVE-SECRETA";
const NOME_DA_ABA = "Agendamentos";

function atualizarAgendamentos() {
  const resposta = UrlFetchApp.fetch(ENDERECO, { muteHttpExceptions: true });
  if (resposta.getResponseCode() !== 200) {
    throw new Error("O site respondeu " + resposta.getResponseCode() + ". Confira o endereço e a chave.");
  }
  const texto = resposta.getContentText("UTF-8").replace(/^﻿/, "");
  const linhas = Utilities.parseCsv(texto, ";");
  const planilha = SpreadsheetApp.getActive();
  const aba = planilha.getSheetByName(NOME_DA_ABA) || planilha.insertSheet(NOME_DA_ABA);
  aba.clearContents();
  aba.getRange(1, 1, linhas.length, linhas[0].length).setNumberFormat("@").setValues(linhas);
  aba.getRange(1, 1, 1, linhas[0].length).setFontWeight("bold");
  aba.setFrozenRows(1);
}

/** Rode esta função UMA vez: ela liga a atualização a cada 1 minuto. */
function ligarAtualizacaoAutomatica() {
  ScriptApp.getProjectTriggers()
    .filter((g) => g.getHandlerFunction() === "atualizarAgendamentos")
    .forEach((g) => ScriptApp.deleteTrigger(g));
  ScriptApp.newTrigger("atualizarAgendamentos").timeBased().everyMinutes(1).create();
  atualizarAgendamentos();
}

/** Para desligar a atualização automática. */
function desligarAtualizacaoAutomatica() {
  ScriptApp.getProjectTriggers()
    .filter((g) => g.getHandlerFunction() === "atualizarAgendamentos")
    .forEach((g) => ScriptApp.deleteTrigger(g));
}
