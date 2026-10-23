
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Rase Tickets is online!"));
app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Web server is running.");
});

const CONFIG = {
  STAFF_ROLE_ID: "1507680371414929438",
  CATEGORY_ID: "1507673669386895391",
  TICKET_IMAGE_URL:
    "https://media.discordapp.net/attachments/1475361722155143298/1507700140834685008/image.png"
};

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing TOKEN, CLIENT_ID, or GUILD_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const setupCommand = new SlashCommandBuilder()
  .setName("setup-ticket")
  .setDescription("إرسال لوحة نظام التذاكر");

async function registerCommand() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [setupCommand.toJSON()] }
  );

  console.log("تم تسجيل أمر /setup-ticket بنجاح.");
}

client.once("clientReady", async () => {
  console.log(`البوت متصل: ${client.user.tag}`);

  try {
    await registerCommand();
  } catch (error) {
    console.error("فشل تسجيل أمر السلاش:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand() &&
        interaction.commandName === "setup-ticket") {
      if (!interaction.inGuild()) {
        return interaction.reply({
          content: "هذا الأمر يعمل داخل السيرفر فقط.",
          ephemeral: true
        });
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "هذا الأمر مخصص للمسؤولين فقط.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("💬 مركز المساعدة والتواصل للسيرفر")
        .setDescription(
          "مرحباً بك في مركز الدعم! 👋\n" +
          "اختر نوع التذكرة من القائمة أدناه.\n\n" +
          "🛠️ **مساعدة عامة:** استفسارات عن السيرفر والرتب.\n" +
          "🚨 **بلاغ / شكوى:** للإبلاغ عن مخالفة أو مشكلة.\n" +
          "💡 **اقتراح:** شاركنا أفكارك لتطوير السيرفر."
        )
        .setColor("#5865F2");

      if (CONFIG.TICKET_IMAGE_URL) {
        embed.setImage(CONFIG.TICKET_IMAGE_URL);
      }

      if (interaction.guild.iconURL()) {
        embed.setFooter({
          text: "نظام التذاكر المطور - سيرفر السوالف",
          iconURL: interaction.guild.iconURL()
        });
      } else {
        embed.setFooter({ text: "نظام التذاكر المطور - سيرفر السوالف" });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_ticket_type")
        .setPlaceholder("👇 اختر سبب فتح التذكرة")
        .addOptions(
          {
            label: "مساعدة واستفسار عام",
            description: "استفسارات عامة عن السيرفر أو الفعاليات",
            value: "general_support",
            emoji: "🛠️"
          },
          {
            label: "بلاغ عن عضو / شكوى",
            description: "الإبلاغ عن مخالفة لقوانين السيرفر",
            value: "report_support",
            emoji: "🚨"
          },
          {
            label: "اقتراح / فكرة جديدة",
            description: "شاركنا أفكارك لتطوير السيرفر",
            value: "suggestion_support",
            emoji: "💡"
          }
        );

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
      return;
    }

    if (interaction.isStringSelectMenu() &&
        interaction.customId === "select_ticket_type") {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const user = interaction.user;
      const selectedType = interaction.values[0];

      const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic === `ticket-owner:${user.id}`
      );

      if (existing) {
        return interaction.editReply({
          content: `❌ لديك تذكرة مفتوحة بالفعل: ${existing}`
        });
      }

      const types = {
        general_support: "مساعدة عامة",
        report_support: "بلاغ / شكوى",
        suggestion_support: "اقتراح"
      };

      const safeName = user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 20) || user.id.slice(-6);

      const permissionOverwrites = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ];

      const staffRole = guild.roles.cache.get(CONFIG.STAFF_ROLE_ID);
      if (staffRole) {
        permissionOverwrites.push({
          id: staffRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        });
      }

      const channelOptions = {
        name: `ticket-${safeName}`.slice(0, 90),
        type: ChannelType.GuildText,
        topic: `ticket-owner:${user.id}`,
        permissionOverwrites
      };

      if (CONFIG.CATEGORY_ID &&
          guild.channels.cache.has(CONFIG.CATEGORY_ID)) {
        channelOptions.parent = CONFIG.CATEGORY_ID;
      }

      const ticketChannel = await guild.channels.create(channelOptions);

      const ticketEmbed = new EmbedBuilder()
        .setTitle(`💬 تذكرة جديدة: ${types[selectedType] || "دعم"}`)
        .setDescription(
          `أهلاً بك <@${user.id}>!\n\n` +
          "يرجى توضيح مشكلتك أو طلبك بالتفصيل، وسيرد فريق الإدارة عليك قريباً."
        )
        .setColor("#57F287")
        .setTimestamp();

      const closeButton = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("إغلاق التكت")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(closeButton);

      await ticketChannel.send({
        content: `${user} ${staffRole ? `<@&${staffRole.id}>` : ""}`,
        embeds: [ticketEmbed],
        components: [row]
      });

      await interaction.editReply({
        content: `✅ تم فتح تذكرتك بنجاح: ${ticketChannel}`
      });
      return;
    }

    if (interaction.isButton() &&
        interaction.customId === "close_ticket") {
      const member = interaction.member;
      const isStaff = member?.roles?.cache?.has(CONFIG.STAFF_ROLE_ID);
      const isAdmin = interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator
      );

      const isOwner =
        interaction.channel?.topic === `ticket-owner:${interaction.user.id}`;

      if (!isStaff && !isAdmin && !isOwner) {
        return interaction.reply({
          content: "ليس لديك صلاحية إغلاق هذه التذكرة.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 سيتم حذف التذكرة خلال 5 ثوانٍ."
      });

      setTimeout(async () => {
        await interaction.channel?.delete().catch(console.error);
      }, 5000);
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.isRepliable() && !interaction.replied &&
        !interaction.deferred) {
      await interaction.reply({
        content: "حدث خطأ. راجع Logs في الاستضافة.",
        ephemeral: true
      }).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.editReply({
        content: "حدث خطأ أثناء تنفيذ الطلب. راجع Logs في الاستضافة."
      }).catch(() => {});
    }
  }
});

client.login(TOKEN).catch(error => {
  console.error("فشل تسجيل دخول البوت:", error);
  process.exit(1);
});
