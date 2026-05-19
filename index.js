require('dotenv').config();

const {
  ActionRowBuilder,
  ActivityType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('./config');

let client = createClient(config.welcome.enabled);
const ticketCreationLocks = new Set();

process.on('unhandledRejection', (error) => {
  console.error('Errore non gestito:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Eccezione non gestita:', error);
});

async function sendTicketPanel(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(config.tickets.panelTitle)
    .setDescription(config.tickets.panelDescription)
    .setColor(config.tickets.panelColor)
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_select')
    .setPlaceholder(config.tickets.placeholder)
    .addOptions(config.tickets.options);

  await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  await interaction.editReply({ content: 'Pannello ticket inviato.' });
  await sendLog(interaction.guild, 'Pannello ticket inviato', `${interaction.user} ha inviato un pannello ticket.`, [
    { name: 'Canale', value: `${interaction.channel}`, inline: true },
  ]);
}

async function sendShiftPanel(interaction) {
  await interaction.deferReply({ ephemeral: true });
  await deleteOldBotPanels(interaction.channel, 'Pannello turni');

  const embed = new EmbedBuilder()
    .setTitle('Pannello turni')
    .setDescription('Usa i bottoni qui sotto per iniziare o terminare il turno.')
    .setColor(config.shifts.colorOn)
    .setTimestamp();

  const startButton = new ButtonBuilder()
    .setCustomId('shift_on')
    .setLabel('Inizio turno')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🟢');

  const endButton = new ButtonBuilder()
    .setCustomId('shift_off')
    .setLabel('Fine turno')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔴');

  await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(startButton, endButton)] });
  await interaction.editReply({ content: 'Pannello turni inviato.' });
  await sendLog(interaction.guild, 'Pannello turni inviato', `${interaction.user} ha inviato il pannello turni.`, [
    { name: 'Canale', value: `${interaction.channel}`, inline: true },
  ]);
}

async function deleteOldBotPanels(channel, title) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) return;

  const oldPanels = messages.filter((message) => (
    message.author.id === client.user.id
    && message.embeds.some((embed) => embed.title === title)
  ));

  for (const message of oldPanels.values()) {
    await message.delete().catch(() => null);
  }
}

async function sendInvoicePanel(interaction) {
  await interaction.deferReply({ ephemeral: true });
  await deleteOldBotPanels(interaction.channel, 'Pannello fatturato');

  const embed = new EmbedBuilder()
    .setTitle('Pannello fatturato')
    .setDescription('Premi il bottone qui sotto per compilare il modulo fatturato.')
    .setColor(config.invoice.color)
    .setTimestamp();

  const invoiceButton = new ButtonBuilder()
    .setCustomId('open_invoice_modal')
    .setLabel('Compila fatturato')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🧾');

  await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(invoiceButton)] });
  await interaction.editReply({ content: 'Pannello fatturato inviato.' });
  await sendLog(interaction.guild, 'Pannello fatturato inviato', `${interaction.user} ha inviato il pannello fatturato.`, [
    { name: 'Canale', value: `${interaction.channel}`, inline: true },
  ]);
}

async function handleModeration(interaction) {
  const command = interaction.commandName;

  if (command === 'clear') {
    const amount = interaction.options.getInteger('quantita');
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `Ho cancellato ${deleted.size} messaggi.`, ephemeral: true });
    await sendModerationLog(interaction, 'Messaggi cancellati', [
      { name: 'Moderatore', value: `${interaction.user}`, inline: true },
      { name: 'Canale', value: `${interaction.channel}`, inline: true },
      { name: 'Quantità', value: `${deleted.size}`, inline: true },
    ]);
    return;
  }

  const user = interaction.options.getUser('utente');
  const reason = interaction.options.getString('motivo') || 'Nessun motivo specificato';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (user.id === interaction.user.id) {
    await interaction.reply({ content: 'Non puoi eseguire questa azione su te stesso.', ephemeral: true });
    return;
  }

  if (command === 'warn') {
    await user.send(`Hai ricevuto un avviso in ${interaction.guild.name}. Motivo: ${reason}`).catch(() => null);
    await interaction.reply({ content: `${user} è stato avvisato.`, ephemeral: true });
    await sendModerationLog(interaction, 'Warn utente', [
      { name: 'Moderatore', value: `${interaction.user}`, inline: true },
      { name: 'Utente', value: `${user.tag}`, inline: true },
      { name: 'Motivo', value: reason, inline: false },
    ]);
    return;
  }

  if (!member) {
    await interaction.reply({ content: 'Utente non trovato nel server.', ephemeral: true });
    return;
  }

  if (!member.moderatable && ['timeout', 'untimeout'].includes(command)) {
    await interaction.reply({ content: 'Non posso moderare questo utente. Controlla gerarchia ruoli e permessi bot.', ephemeral: true });
    return;
  }

  if (!member.kickable && command === 'kick') {
    await interaction.reply({ content: 'Non posso espellere questo utente. Controlla gerarchia ruoli e permessi bot.', ephemeral: true });
    return;
  }

  if (!member.bannable && command === 'ban') {
    await interaction.reply({ content: 'Non posso bannare questo utente. Controlla gerarchia ruoli e permessi bot.', ephemeral: true });
    return;
  }

  if (command === 'ban') {
    await user.send(`Sei stato bannato da ${interaction.guild.name}. Motivo: ${reason}`).catch(() => null);
    await member.ban({ reason });
    await interaction.reply({ content: `${user.tag} è stato bannato.`, ephemeral: true });
  }

  if (command === 'kick') {
    await user.send(`Sei stato espulso da ${interaction.guild.name}. Motivo: ${reason}`).catch(() => null);
    await member.kick(reason);
    await interaction.reply({ content: `${user.tag} è stato espulso.`, ephemeral: true });
  }

  if (command === 'timeout') {
    const minutes = interaction.options.getInteger('minuti');
    await member.timeout(minutes * 60 * 1000, reason);
    await user.send(`Sei stato messo in timeout in ${interaction.guild.name} per ${minutes} minuti. Motivo: ${reason}`).catch(() => null);
    await interaction.reply({ content: `${user} è stato messo in timeout per ${minutes} minuti.`, ephemeral: true });
  }

  if (command === 'untimeout') {
    await member.timeout(null, reason);
    await user.send(`Il tuo timeout in ${interaction.guild.name} è stato rimosso. Motivo: ${reason}`).catch(() => null);
    await interaction.reply({ content: `Timeout rimosso a ${user}.`, ephemeral: true });
  }

  await sendModerationLog(interaction, `Moderazione: ${command}`, [
    { name: 'Moderatore', value: `${interaction.user}`, inline: true },
    { name: 'Utente', value: `${user.tag}`, inline: true },
    { name: 'Motivo', value: reason, inline: false },
  ]);
}

async function sendModerationLog(interaction, title, fields) {
  await sendLog(interaction.guild, title, 'Azione di moderazione eseguita.', fields, 0xe67e22);
}

async function createTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (ticketCreationLocks.has(interaction.user.id)) {
    await interaction.editReply({ content: 'Sto già creando il tuo ticket, attendi qualche secondo.' });
    return;
  }

  ticketCreationLocks.add(interaction.user.id);
  const option = config.tickets.options.find((item) => item.value === interaction.values[0]);

  try {
    const existing = interaction.guild.channels.cache.find(
      (channel) => channel.topic === `ticket-owner:${interaction.user.id}` && channel.parentId === config.tickets.categoryId,
    );

    if (existing) {
      await interaction.editReply({ content: `Hai già un ticket aperto: ${existing}` });
      return;
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      type: ChannelType.GuildText,
      parent: config.tickets.categoryId,
      topic: `ticket-owner:${interaction.user.id}`,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
        },
        {
          id: config.tickets.staffRoleIds[0],
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
        },
        ...config.tickets.staffRoleIds.slice(1).map((roleId) => ({
          id: roleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
        })),
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle(`Ticket ${option?.label || 'Supporto'}`)
      .setDescription(`${interaction.user}, descrivi qui la tua richiesta. Lo staff ti risponderà appena possibile.`)
      .setColor(config.tickets.panelColor)
      .setTimestamp();

    const closeButton = new ButtonBuilder().setCustomId('close_ticket').setLabel('Chiudi ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒');

    await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(closeButton)] });
    await interaction.editReply({ content: `Ticket creato: ${channel}` });
    await sendChannelLog(interaction.guild, config.tickets.logChannelId, 'Ticket creato', `${interaction.user} ha creato un ticket.`, [
      { name: 'Categoria', value: option?.label || 'Supporto', inline: true },
      { name: 'Canale', value: `${channel}`, inline: true },
    ], config.tickets.panelColor);
  } finally {
    ticketCreationLocks.delete(interaction.user.id);
  }
}

async function closeTicket(interaction) {
  const canClose = config.tickets.staffRoleIds.some((roleId) => interaction.member.roles.cache.has(roleId)) || interaction.channel.topic === `ticket-owner:${interaction.user.id}`;
  if (!canClose) {
    await interaction.reply({ content: 'Non hai il permesso di chiudere questo ticket.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Ticket in chiusura...', ephemeral: true });
  const transcript = await createTicketTranscript(interaction.channel);
  await sendChannelLog(interaction.guild, config.tickets.logChannelId, 'Ticket chiuso', `${interaction.user} ha chiuso un ticket.`, [
    { name: 'Canale', value: interaction.channel.name, inline: true },
  ], config.tickets.panelColor, transcript);
  await interaction.channel.delete('Ticket chiuso');
}

async function handleShift(interaction) {
  if (config.shifts.roleId && !interaction.member.roles.cache.has(config.shifts.roleId)) {
    await interaction.reply({ content: 'Non hai il ruolo richiesto per usare i turni.', ephemeral: true });
    return;
  }

  const action = interaction.options.getSubcommand();
  const isOn = action === 'on';
  const dateTime = formatDateTime();

  const embed = new EmbedBuilder()
    .setTitle(isOn ? 'Turno iniziato' : 'Turno terminato')
    .setDescription(`${interaction.user} ha ${isOn ? 'iniziato' : 'terminato'} il turno.`)
    .setColor(isOn ? config.shifts.colorOn : config.shifts.colorOff)
    .addFields({ name: 'Data e orario', value: dateTime, inline: true })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
  await sendShiftDm(interaction.user, isOn, dateTime);
  await sendChannelLog(interaction.guild, config.shifts.logChannelId, isOn ? 'Turno iniziato' : 'Turno terminato', `${interaction.user} ha ${isOn ? 'iniziato' : 'terminato'} il turno.`, [
    { name: 'Utente', value: interaction.user.tag, inline: true },
    { name: 'Data e orario', value: dateTime, inline: true },
  ], isOn ? config.shifts.colorOn : config.shifts.colorOff);
}

async function handleShiftButton(interaction, action) {
  if (config.shifts.roleId && !interaction.member.roles.cache.has(config.shifts.roleId)) {
    await interaction.reply({ content: 'Non hai il ruolo richiesto per usare i turni.', ephemeral: true });
    return;
  }

  const isOn = action === 'on';
  const dateTime = formatDateTime();
  const avatarUrl = interaction.user.displayAvatarURL({ size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(isOn ? 'Turno iniziato' : 'Turno terminato')
    .setDescription(`${interaction.user} ha ${isOn ? 'iniziato' : 'terminato'} il turno.`)
    .setColor(isOn ? config.shifts.colorOn : config.shifts.colorOff)
    .setThumbnail(avatarUrl)
    .addFields({ name: 'Data e orario', value: dateTime, inline: true })
    .setTimestamp();

  await interaction.deferUpdate();
  await sendShiftDm(interaction.user, isOn, dateTime);
  await sendChannelLog(interaction.guild, config.shifts.logChannelId, isOn ? 'Turno iniziato' : 'Turno terminato', `${interaction.user} ha ${isOn ? 'iniziato' : 'terminato'} il turno dal pannello.`, [
    { name: 'Utente', value: interaction.user.tag, inline: true },
    { name: 'Data e orario', value: dateTime, inline: true },
  ], isOn ? config.shifts.colorOn : config.shifts.colorOff);
}

async function showInvoiceModal(interaction) {
  if (config.invoice.roleId && !interaction.member.roles.cache.has(config.invoice.roleId)) {
    await interaction.reply({ content: 'Non hai il ruolo richiesto per compilare il fatturato.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder().setCustomId('invoice_modal').setTitle('Modulo fatturato');

  const firstNameInput = new TextInputBuilder()
    .setCustomId('first_name')
    .setLabel('Nome')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const lastNameInput = new TextInputBuilder()
    .setCustomId('last_name')
    .setLabel('Cognome')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('Importo fatturato')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Esempio: 15000')
    .setRequired(true);

  const signatureInput = new TextInputBuilder()
    .setCustomId('signature')
    .setLabel('Firma')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(firstNameInput),
    new ActionRowBuilder().addComponents(lastNameInput),
    new ActionRowBuilder().addComponents(amountInput),
    new ActionRowBuilder().addComponents(signatureInput),
  );

  await interaction.showModal(modal);
}

async function submitInvoice(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const firstName = interaction.fields.getTextInputValue('first_name');
  const lastName = interaction.fields.getTextInputValue('last_name');
  const rawAmount = interaction.fields.getTextInputValue('amount').replace(',', '.').replace(/[^0-9.]/g, '');
  const amount = Number.parseFloat(rawAmount);
  const signature = interaction.fields.getTextInputValue('signature');

  if (!Number.isFinite(amount) || amount <= 0) {
    await interaction.editReply({ content: 'Importo non valido. Inserisci solo numeri, ad esempio 15000.' });
    return;
  }

  const percentageAmount = amount * (config.invoice.percentage / 100);

  const embed = new EmbedBuilder()
    .setTitle('Nuovo modulo fatturato')
    .setColor(config.invoice.color)
    .addFields(
      { name: 'Nome e cognome', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Importo fatturato', value: formatCurrency(amount), inline: true },
      { name: `${config.invoice.percentage}%`, value: formatCurrency(percentageAmount), inline: true },
      { name: 'Firma', value: signature, inline: false },
      { name: 'Compilato da', value: `${interaction.user}`, inline: false },
    )
    .setTimestamp();

  await interaction.editReply({ content: 'Modulo fatturato inviato correttamente.' });
  await sendEmbedToChannel(interaction.guild, config.invoice.logChannelId, embed);
}

async function createTicketTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return null;

  const lines = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => {
      const time = new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: config.shifts.timezone,
      }).format(message.createdAt);
      const parts = [];

      const textContent = message.cleanContent || message.content;
      if (textContent) parts.push(textContent);

      for (const embed of message.embeds) {
        const embedParts = [];
        if (embed.title) embedParts.push(`Titolo embed: ${embed.title}`);
        if (embed.description) embedParts.push(`Descrizione embed: ${embed.description}`);
        for (const field of embed.fields) {
          embedParts.push(`${field.name}: ${field.value}`);
        }
        if (embed.url) embedParts.push(`URL embed: ${embed.url}`);
        if (embed.image?.url) embedParts.push(`Immagine embed: ${embed.image.url}`);
        if (embed.thumbnail?.url) embedParts.push(`Thumbnail embed: ${embed.thumbnail.url}`);
        if (embedParts.length > 0) parts.push(embedParts.join(' | '));
      }

      for (const attachment of message.attachments.values()) {
        parts.push(`Allegato: ${attachment.name} - ${attachment.url}`);
      }

      for (const sticker of message.stickers.values()) {
        parts.push(`Sticker: ${sticker.name}`);
      }

      return `[${time}] ${message.author.tag}: ${parts.join(' || ') || '[messaggio vuoto]'}`;
    });

  const buffer = Buffer.from(lines.join('\n'), 'utf8');
  return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
}

async function sendChannelLog(guild, channelId, title, description, fields = [], color = config.logs.color, attachment = null) {
  if (!guild || !channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (fields.length > 0) embed.addFields(fields);

  await channel.send({ embeds: [embed], files: attachment ? [attachment] : [] });
}

async function sendEmbedToChannel(guild, channelId, embed) {
  if (!guild || !channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  await channel.send({ embeds: [embed] });
}

async function sendLog(guild, title, description, fields = [], color = config.logs.color) {
  if (!config.logs.enabled || !guild || !config.logs.channelId) return;

  const channel = guild.channels.cache.get(config.logs.channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (fields.length > 0) embed.addFields(fields);

  await channel.send({ embeds: [embed] });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

async function sendShiftDm(user, isOn, dateTime) {
  const avatarUrl = user.displayAvatarURL({ size: 256 });
  const embed = new EmbedBuilder()
    .setTitle(isOn ? 'Hai iniziato il turno' : 'Hai terminato il turno')
    .setDescription(`Hai ${isOn ? 'iniziato' : 'terminato'} il turno correttamente.`)
    .setColor(isOn ? config.shifts.colorOn : config.shifts.colorOff)
    .setThumbnail(avatarUrl)
    .addFields({ name: 'Data e orario', value: dateTime, inline: true })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch (error) {
    console.warn(`Impossibile inviare DM turno a ${user.tag}: ${error.message}`);
  }
}

function formatDateTime() {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: config.shifts.timezone,
  }).format(new Date());
}

function createClient(welcomeEnabled) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ];

  if (welcomeEnabled) intents.push(GatewayIntentBits.GuildMembers);

  return new Client({
    intents,
  });
}

function registerEvents(botClient) {
  botClient.once(Events.ClientReady, async (readyClient) => {
    readyClient.user.setActivity(config.bot.status, { type: ActivityType.Watching });
    console.log(`Bot online come ${readyClient.user.tag}`);
    await sendLog(readyClient.guilds.cache.first(), 'Bot online', `Il bot è online come ${readyClient.user.tag}.`, [
      { name: 'Server attivi', value: `${readyClient.guilds.cache.size}`, inline: true },
      { name: 'Welcome', value: config.welcome.enabled ? 'Attivo' : 'Disattivato', inline: true },
    ]);
  });

  botClient.on(Events.GuildMemberAdd, async (member) => {
    if (!config.welcome.enabled) return;

    const channel = member.guild.channels.cache.get(config.welcome.channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(config.welcome.title)
        .setDescription(config.welcome.description.replaceAll('{user}', `${member}`))
        .setColor(config.welcome.color)
        .setTimestamp();

      if (config.welcome.thumbnailUrl) embed.setThumbnail(config.welcome.thumbnailUrl);
      if (config.welcome.imageUrl) embed.setImage(config.welcome.imageUrl);

      await channel.send({ embeds: [embed] });
    }

    if (config.welcome.roleId) {
      const role = member.guild.roles.cache.get(config.welcome.roleId);
      if (role) {
        await member.roles.add(role).catch((error) => console.warn(`Impossibile assegnare ruolo di benvenuto a ${member.user.tag}: ${error.message}`));
      }
    }

    await sendLog(member.guild, 'Nuovo membro', `${member} è entrato nel server.`, [
      { name: 'Utente', value: `${member.user.tag}`, inline: true },
      { name: 'ID', value: member.id, inline: true },
    ]);
  });

  botClient.on(Events.InteractionCreate, handleInteraction);
}

async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ticket-panel') await sendTicketPanel(interaction);
      if (interaction.commandName === 'turno-panel') await sendShiftPanel(interaction);
      if (interaction.commandName === 'fatturato-panel') await sendInvoicePanel(interaction);
      if (interaction.commandName === 'turno') await handleShift(interaction);
      if (interaction.commandName === 'fatturato') await showInvoiceModal(interaction);
      if (['ban', 'kick', 'timeout', 'untimeout', 'clear', 'warn'].includes(interaction.commandName)) await handleModeration(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      await createTicket(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'close_ticket') await closeTicket(interaction);
      if (interaction.customId === 'shift_on') await handleShiftButton(interaction, 'on');
      if (interaction.customId === 'shift_off') await handleShiftButton(interaction, 'off');
      if (interaction.customId === 'open_invoice_modal') await showInvoiceModal(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'invoice_modal') {
      await submitInvoice(interaction);
    }
  } catch (error) {
    console.error(error);
    if ([40060, 10062].includes(error.code)) return;

    if (interaction.guild) {
      await sendLog(interaction.guild, 'Errore interazione', error.message || 'Errore sconosciuto', [
        { name: 'Utente', value: `${interaction.user.tag}`, inline: true },
        { name: 'Tipo', value: interaction.type.toString(), inline: true },
      ], 0xe74c3c);
    }

    const payload = { content: 'Si è verificato un errore. Controlla configurazione e permessi del bot.', ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch (replyError) {
      if (![40060, 10062].includes(replyError.code)) console.error(replyError);
    }
  }
}

async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Configura DISCORD_TOKEN nel file .env');
  }

  registerEvents(client);

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    if (!config.welcome.enabled || !String(error.message).includes('Used disallowed intents')) throw error;

    console.warn('Server Members Intent non disponibile. Riavvio automatico senza welcome.');
    config.welcome.enabled = false;
    client = createClient(false);
    registerEvents(client);
    await client.login(process.env.DISCORD_TOKEN);
  }
}

startBot();

