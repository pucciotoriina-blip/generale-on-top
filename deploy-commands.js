require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Invia il pannello ticket con menu a tendina')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('turno-panel')
    .setDescription('Invia il pannello turni con bottoni')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('fatturato-panel')
    .setDescription('Invia il pannello fatturato con bottone modulo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('turno')
    .setDescription('Gestisci il turno lavorativo')
    .addSubcommand((subcommand) => subcommand.setName('on').setDescription('Entra in turno'))
    .addSubcommand((subcommand) => subcommand.setName('off').setDescription('Esci dal turno')),
  new SlashCommandBuilder()
    .setName('fatturato')
    .setDescription('Compila il modulo fatturato con calcolo percentuale'),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banna un utente dal server')
    .addUserOption((option) => option.setName('utente').setDescription('Utente da bannare').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo del ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Espelle un utente dal server')
    .addUserOption((option) => option.setName('utente').setDescription('Utente da espellere').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo del kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mette un utente in timeout')
    .addUserOption((option) => option.setName('utente').setDescription('Utente da mettere in timeout').setRequired(true))
    .addIntegerOption((option) => option.setName('minuti').setDescription('Durata in minuti').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo del timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Rimuove il timeout da un utente')
    .addUserOption((option) => option.setName('utente').setDescription('Utente a cui rimuovere il timeout').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Cancella messaggi dal canale')
    .addIntegerOption((option) => option.setName('quantita').setDescription('Numero messaggi da cancellare').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avvisa un utente')
    .addUserOption((option) => option.setName('utente').setDescription('Utente da avvisare').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo del warn').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    throw new Error('Configura DISCORD_TOKEN, CLIENT_ID e GUILD_ID nel file .env');
  }

  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
  console.log('Comandi slash registrati correttamente.');
}

deployCommands().catch((error) => {
  console.error(error);
  process.exit(1);
});
