
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
  Routes,
  AttachmentBuilder
} = require("discord.js");

const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Rase Tickets is online!"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

const CONFIG = {
  STAFF_ROLE_ID: "1507680371414929438",
  CATEGORY_ID: "1507673669386895391"
};

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("تأكد من TOKEN و CLIENT_ID و GUILD_ID في Environment.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const command = new SlashCommandBuilder()
  .setName("setup-ticket")
  .setDescription("إرسال لوحة التذاكر")
  .addAttachmentOption(option =>
    option
      .setName("image")
      .setDescription("صورة لوحة التذاكر (اختياري)")
      .setRequired(false)
  );

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [command.toJSON()] }
  );

  console.log("تم تسجيل أمر /setup-ticket بنجاح.");
}

client.once("ready", async () => {
  console.log(`البوت متصل: ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("خطأ تسجيل الأمر:", error);
  }
});

client.on("interactionCreate", async interaction => {
  try {
    // أمر إعداد لوحة التذاكر
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "setup-ticket"
    ) {
      if (!interaction.inGuild()) {
        return interaction.reply({
          content: "استخدم الأمر داخل السيرفر.",
          ephemeral: true
        });
      }

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        return interaction.reply({
          content: "هذا الأمر للمسؤولين فقط.",
          ephemeral: true
        });
      }

      const image = interaction.options.getAttachment("image");

      const embed = new EmbedBuilder()
        .setTitle("مركز المساعدة والتواصل")
        .setDescription(
          "مرحبًا بك في مركز الدعم! 👋\n" +
          "اختر نوع التذكرة من القائمة أدناه.\n\n" +
          "🎭 **طلب رول**\n" +
          "🚨 **شكوى على إداري**\n" +
          "👤 **شكوى على عضو**\n" +
          "❓ **استفسار**"
        )
        .setColor("#5865F2")
        .setFooter({ text: "Rase Tickets" });

      if (image && image.contentType?.startsWith("image/")) {
        embed.setImage(image.url);
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_ticket_type")
        .setPlaceholder("اختر نوع التذكرة")
        .addOptions(
          {
            label: "طلب رول",
            description: "طلب رتبة في السيرفر",
            value: "role_request",
            emoji: "🎭"
          },
          {
            label: "شكوى على إداري",
            description: "تقديم شكوى على أحد الإداريين",
            value: "admin_complaint",
            emoji: "🚨"
          },
          {
            label: "شكوى على عضو",
            description: "تقديم شكوى على أحد الأعضاء",
            value: "member_complaint",
            emoji: "👤"
          },
          {
            label: "استفسار",
            description: "أي سؤال أو استفسار",
            value: "inquiry",
            emoji: "❓"
          }
        );

      await interaction.reply({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });

      return;
    }

    // إنشاء تذكرة
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "select_ticket_type"
    ) {
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
          content: `لديك تذكرة مفتوحة بالفعل: ${existing}`
        });
      }

      const typeNames = {
        role_request: "طلب رول",
        admin_complaint: "شكوى على إداري",
        member_complaint: "شكوى على عضو",
        inquiry: "استفسار"
      };

      const safeName = user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 18) || user.id.slice(-6);

      const overwrites = [
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
        overwrites.push({
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
        permissionOverwrites: overwrites
      };

      if (guild.channels.cache.has(CONFIG.CATEGORY_ID)) {
        channelOptions.parent = CONFIG.CATEGORY_ID;
      }

      const ticket = await guild.channels.create(channelOptions);

      const ticketEmbed = new EmbedBuilder()
        .setTitle(`تذكرة جديدة: ${typeNames[selectedType]}`)
        .setDescription(
          `أهلًا بك ${user}!\n\n` +
          "اشرح طلبك أو مشكلتك بالتفصيل، وسيرد فريق الإدارة عليك."
        )
        .setColor("#57F287")
        .setTimestamp();

      const closeButton = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("إغلاق التكت")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger);

      await ticket.send({
        content: `${user} ${staffRole ? `<@&${staffRole.id}>` : ""}`,
        embeds: [ticketEmbed],
        components: [
          new ActionRowBuilder().addComponents(closeButton)
        ]
      });

      await interaction.editReply({
        content: `تم فتح تذكرتك بنجاح: ${ticket}`
      });

      return;
    }

    // زر إغلاق التذكرة
    if (
      interaction.isButton() &&
      interaction.customId === "close_ticket"
    ) {
      const channel = interaction.channel;
      const member = interaction.member;

      const isOwner =
        channel?.topic === `ticket-owner:${interaction.user.id}`;

      const isAdmin = interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator
      );

      const isStaff = member?.roles?.cache?.has(
        CONFIG.STAFF_ROLE_ID
      );

      if (!isOwner && !isAdmin && !isStaff) {
        return interaction.reply({
          content: "ليس لديك صلاحية إغلاق هذه التذكرة.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "سيتم إغلاق التذكرة خلال 5 ثوانٍ."
      });

      setTimeout(() => {
        channel?.delete().catch(console.error);
      }, 5000);
    }
  } catch (error) {
    console.error("خطأ أثناء تنفيذ التفاعل:", error);

    if (interaction.isRepliable()) {
      const message = "حدث خطأ. راجع Logs في الاستضافة.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message }).catch(() => {});
      } else {
        await interaction.reply({
          content: message,
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
});

client.login(TOKEN).catch(error => {
  console.error("فشل تسجيل دخول البوت:", error);
  process.exit(1);
});

client.login(TOKEN).catch(error => {
  console.error("فشل تسجيل دخول البوت:", error);
  process.exit(1);
});
