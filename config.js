module.exports = {
  bot: {
    status: 'Hype LS Customs',
  },

  logs: {
    channelId: '1505873068646465536',
    color: 0x95a5a6,
    enabled: true,
  },

  welcome: {
    enabled: true,
    channelId: '1504053832240595045',
    title: 'Benvenuto in Hype LS Customs',
    description: 'Ciao {user}, benvenuto nel team!',
    color: 0xff7a00,
    imageUrl: 'https://imgur.com/a/jM92oMq',
    thumbnailUrl: '',
    roleId: '',
  },

  tickets: {
    categoryId: '1505854193120972820',
    staffRoleIds: ['1503796306198397040', '1503795462837108826'],
    logChannelId: '1505867974563856445',
    panelTitle: 'Ticket Hype LS Customs',
    panelDescription: 'Seleziona dal menu il tipo di assistenza di cui hai bisogno.',
    panelColor: 0xff7a00,
    placeholder: 'Scegli una categoria ticket',
    options: [
      {
        label: 'Direzione',
        value: 'diirezione',
        description: 'Interagisci con la direzione',
        emoji: '🛠️',
      },
      {
        label: 'Assunzione',
        value: 'assunzione',
        description: 'Richiedi un colloquio',
        emoji: '🔌',
      },
      {
        label: 'Convenzioni',
        value: 'convenzioni',
        description: 'Invia una proposta',
        emoji: '📋',
      },
    ],
  },

  shifts: {
    logChannelId: '1505853937369088071',
    roleId: '1505855281387667487',
    timezone: 'Europe/Rome',
    colorOn: 0x2ecc71,
    colorOff: 0xe74c3c,
  },

  invoice: {
    logChannelId: '1505867899418706031',
    roleId: '1505855281387667487',
    percentage: 10,
    color: 0x3498db,
  },
};
