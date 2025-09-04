const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Function to get system info from the API
async function fetchSystemDetails(id, address = null) {
  try {
    // Build the API URL
    let apiUrl;
    if (address) {
      apiUrl = `https://starblast.dankdmitron.dev/api/status/${id}@${address}`;
    } else {
      // Try to find the address from simstatus
      const simstatusResponse = await fetch('https://starblast.io/simstatus.json');
      const simstatus = await simstatusResponse.json();
      
      let foundAddress = null;
      for (const location of simstatus) {
        if (location.systems) {
          for (const system of location.systems) {
            if (system.id == id) {
              foundAddress = location.address;
              break;
            }
          }
        }
        if (foundAddress) break;
      }
      
      if (foundAddress) {
        apiUrl = `https://starblast.dankdmitron.dev/api/status/${id}@${foundAddress}`;
      } else {
        apiUrl = `https://starblast.dankdmitron.dev/api/status/${id}`;
      }
    }
    
    console.log('Fetching from:', apiUrl);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return { error: `HTTP error: ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.error === "no_system") {
      return { error: "System not found" };
    }
    
    if (!data.name) {
      return { error: "Invalid system data" };
    }
    
    // Extract player information
    const players = [];
    let ecpCount = 0;
    
    if (data.players) {
      for (const playerId in data.players) {
        const player = data.players[playerId];
        if (player.player_name) {
          players.push(player.player_name);
          if (player.custom) {
            ecpCount++;
          }
        }
      }
    }
    
    return {
      id: id,
      name: data.name,
      mode: data.mode || "unknown",
      time: data.time ? Math.round(data.time / 60) : 0,
      criminal: data.criminal_activity || 0,
      playerCount: players.length,
      ecpCount: ecpCount,
      players: players,
      address: address
    };
    
  } catch (error) {
    console.error('Error fetching system details:', error);
    return { error: "Failed to fetch system information" };
  }
}

// Extract ID from Starblast URL
function extractIdFromUrl(url) {
  const match = url.match(/starblast\.io\/#(\d+)(@[^\/\s]*)?/);
  if (match) {
    return {
      id: match[1],
      address: match[2] ? match[2].substring(1) : null
    };
  }
  return null;
}

// Format the system information for Discord
function formatSystemInfo(system) {
  if (system.error) {
    return `❌ Error: ${system.error}`;
  }

  const gameLink = system.address 
    ? `https://starblast.io/#${system.id}@${system.address}`
    : `https://starblast.io/#${system.id}`;

  let response = `**${system.name}** (ID: ${system.id})\n`;
  response += `Mode: ${system.mode} | Time: ${system.time} min\n`;
  response += `Players: ${system.playerCount} | ECP: ${system.ecpCount} | Crimes: ${system.criminal}\n`;
  response += `Join: ${gameLink}\n\n`;

  // Add player list
  if (system.players.length > 0) {
    response += `**Players:**\n${system.players.join(', ')}`;
  } else {
    response += `No players found.`;
  }

  // Discord has a 2000 character limit for messages
  if (response.length > 2000) {
    response = response.substring(0, 1990) + "...\n(Message truncated due to length)";
  }

  return response;
}

// Bot event handlers
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check for the !info command
  if (message.content.startsWith('!info')) {
    const args = message.content.split(' ');
    
    if (args.length < 2) {
      return message.reply('Please provide a Starblast.io game URL. Usage: `!info https://starblast.io/#123`');
    }

    const url = args[1];
    const idData = extractIdFromUrl(url);

    if (!idData) {
      return message.reply('Invalid Starblast.io URL. Please provide a valid URL like: https://starblast.io/#123');
    }

    // Send a "processing" message
    const processingMsg = await message.reply('Fetching server information...');

    try {
      const systemInfo = await fetchSystemDetails(idData.id, idData.address);
      
      // Edit the original message with the results
      await processingMsg.edit(formatSystemInfo(systemInfo));
    } catch (error) {
      console.error('Error:', error);
      await processingMsg.edit('❌ An error occurred while fetching server information.');
    }
  }
});

// Login to Discord
client.login('YOUR_DISCORD_BOT_TOKEN');
