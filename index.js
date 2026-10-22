const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");
const express = require("express");

// تشغيل سيرفر بسيط لمنع توقف الخدمة المجانية في Render
const app = express();
app.get("/", (req, res) => res.send("Bot is Online!"));
app.listen(process.env.PORT || 3000);

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ⚙️ إعدادات البوت (ضع الآيديات الخاصة بك هنا)
const CONFIG = {
  STAFF_ROLE_ID: "1507680371414929438", 
  CATEGORY_ID: "1507673669386895391",      
  TICKET_IMAGE_URL: "https://media.discordapp.net/attachments/1475361722155143298/1507700140834685008/image.png?ex=6adb3ead&is=6ad9ed2d&hm=e9d1152d8c78ee3ac8c5e92fd1ebe8ece3f74175a3d9a81e68242c9ae60d67f9&=&format=webp&quality=lossless"      
};

client.once("ready", () => {
  console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);
});

// 📌 أمر إرسال لوحة التذاكر (!setup)
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!setup") {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ هذا الأمر للمسؤولين فقط.");
    }

    const embed = new EmbedBuilder()
      .setTitle("💬 مركز المساعدة والتواصل")
      .setDescription(
        "مرحباً بك في مركز المساعدة والتواصل الخاص بالسيرفر! 👋\n" +
        "إذا كان لديك أي استفسار، شكوى، أو فكرة تحب تشاركنا إياها، يمكنك فتح تذكرة من القائمة أدناه.\n\n" +
        "🛠️ **مساعدة عامة:** للاستفسارات عن السيرفر والفعاليات والرتب.\n" +
        "🚨 **بلاغ / شكوى:** للإبلاغ عن مخالفة من عضو أو مشكلة.\n" +
        "💡 **اقتراح:** لتقديم أفكار وتطويرات جديدة للسيرفر."
      )
      .setColor("#5865F2");

    if (CONFIG.TICKET_IMAGE_URL && CONFIG.TICKET_IMAGE_URL.startsWith("http")) {
      embed.setImage(CONFIG.TICKET_IMAGE_URL);
    }

    embed.setFooter({ text: "نظام الدعم والتواصل", iconURL: message.guild.iconURL() });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_ticket_type")
      .setPlaceholder("👇 اختر سبب فتح التذكرة...")
      .addOptions([
        {
          label: "مساعدة واستفسار عام",
          description: "استفسارات عن السيرفر، الرتب، أو الفعاليات",
          value: "general_support",
          emoji: "🛠️"
        },
        {
          label: "بلاغ عن عضو / شكوى",
          description: "الإبلاغ عن إساءة أو مخالفة لموانين السيرفر",
          value: "report_support",
          emoji: "🚨"
        },
        {
          label: "اقتراح / فكرة جديدة",
          description: "شاركنا أفكارك لتطوير السيرفر والرومات",
          value: "suggestion_support",
          emoji: "💡"
        }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }
});

// 📌 التفاعل عند فتح وإغلاق التذاكر
client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "select_ticket_type") {
    const selectedType = interaction.values[0];
    const guild = interaction.guild;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    const existingChannel = guild.channels.cache.find(
      c => c.name === `ticket-${user.username.toLowerCase()}`
    );

    if (existingChannel) {
      return interaction.editReply({
        content: `❌ لديك تذكرة مفتوحة بالفعل: ${existingChannel}`
      });
    }

    let typeName = "مساعدة-عامة";
    if (selectedType === "report_support") typeName = "بلاغ";
    if (selectedType === "suggestion_support") typeName = "اقتراح";

    try {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CATEGORY_ID !== "1507673725942628522" ? CONFIG.CATEGORY_ID : null,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: CONFIG.STAFF_ROLE_ID !== "1507680371414929438" ? CONFIG.STAFF_ROLE_ID : guild.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles
            ]
          }
        ]
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle(`💬 تذكرة جديدة: ${typeName}`)
        .setDescription(
          `أهلاً بك <@${user.id}>!\n\n` +
          `شكراً لتواصلك معنا. يرجى كتابة تفاصيل موضوعك أو مشكلتك هنا وسيقوم أحد المسؤولين بالرد عليك في أقرب وقت.`
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
        content: `<@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
        embeds: [ticketEmbed],
        components: [row]
      });

      await interaction.editReply({
        content: `✅ تم فتح تذكرتك بنجاح: ${ticketChannel}`
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: "❌ حدث خطأ أثناء إنشاء التذكرة. تأكد من إعطاء البوت الصلاحيات الكافية."
      });
    }
  }

  if (interaction.isButton() && interaction.customId === "close_ticket") {
    await interaction.reply({
      content: "🔒 سيتم إغلاق التذكرة وحذف القناة خلال 5 ثوانٍ..."
    });

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

client.login(TOKEN);
