const { ethers } = require('ethers');
const axios = require('axios');
const chalk = require('chalk');
const TelegramBot = require('node-telegram-bot-api');

const privateKey = 'privatekey'; // Ganti dengan private key Anda
const telegramBotToken = 'bot token'; // Ganti dengan token bot Telegram Anda
const chatId = 'CHAT ID'; // Ganti dengan chat ID Anda

const rpcUrl = 'RPC';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

// Alamat smart contract
const contractAddress = '0xA51894664A773981C6C112C43ce576f315d5b1B6';

// ABI dari fungsi deposit dan withdraw
const abi = [
    "function deposit() payable",
    "function withdraw(uint256 wad)"
];

// Buat instance contract
const contract = new ethers.Contract(contractAddress, abi, wallet);

// Buat instance bot Telegram
const bot = new TelegramBot(telegramBotToken, { polling: true });

// Fungsi untuk mengirim pesan ke bot Telegram
async function sendTelegramMessage(message) {
    try {
        await bot.sendMessage(chatId, message);
        console.log(chalk.green('Pesan terkirim ke Telegram!'));
    } catch (error) {
        console.error(chalk.red('Gagal mengirim pesan ke Telegram:'), error);
    }
}

// Fungsi untuk memanggil deposit dengan ETH
async function sendDeposit() {
    try {
        const gasPrice = ethers.utils.parseUnits('0.14', 'gwei');
        const value = ethers.utils.parseEther('0.005');

        const tx = await contract.deposit({
            value: value,
            gasPrice: gasPrice,
            gasLimit: 38000
        });

        console.log(chalk.blue('Transaksi deposit terkirim, hash:'), chalk.green(`https://taikoexplorer.com/tx/${tx.hash}`));

        // Menunggu transaksi sukses
        const receipt = await tx.wait();
        console.log(chalk.green('Transaksi deposit sukses:'), {
            transactionHash: receipt.transactionHash,
            status: receipt.status === 1 ? 'sukses' : 'gagal',
        });

    } catch (error) {
        console.error(chalk.red('Gagal mengirim transaksi deposit:'), error);
    }
}

// Fungsi untuk memanggil withdraw dengan ETH
async function sendWithdraw(amount) {
    try {
        const gasPrice = ethers.utils.parseUnits('0.14', 'gwei');
        
        // Konversi jumlah ke wei (misalnya, jika Anda ingin menarik 0.005 ETH)
        const value = ethers.utils.parseEther(amount.toString());

        const tx = await contract.withdraw(value, {
            gasPrice: gasPrice,
            gasLimit: 38000
        });

        console.log(chalk.blue('Transaksi withdraw terkirim, hash:'), chalk.green(`https://taikoexplorer.com/tx/${tx.hash}`));

        // Menunggu transaksi sukses
        const receipt = await tx.wait();
        console.log(chalk.green('Transaksi withdraw sukses:'), {
            transactionHash: receipt.transactionHash,
            status: receipt.status === 1 ? 'sukses' : 'gagal',
        });

    } catch (error) {
        console.error(chalk.red('Gagal mengirim transaksi withdraw:'), error);
    }
}

// Fungsi untuk cek point
async function getPointsValue() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
        };

        const getDataPointResponse = await axios.get(`https://trailblazer.mainnet.taiko.xyz/s2/user/rank?address=${wallet.address}`, { headers });
        const responsePoint = getDataPointResponse.data;

        // Filter hanya untuk event 'Transaction'
        const transactionEvent = responsePoint.breakdown.find((item) => item.event === 'Transaction');

        let message = `Address: ${responsePoint.address} | Rank: ${responsePoint.rank} | Blacklisted: ${responsePoint.blacklisted}`;
        if (transactionEvent) {
            message += ` | TransactionPoints: ${transactionEvent.total_points}`;
        } else {
            message += ` | No Transaction event found`;
        }

        // Kirim hasil ke Telegram
        await sendTelegramMessage(message);

    } catch (error) {
        console.error(chalk.red("Error: "), error);
    }
}

// Fungsi untuk menjalankan semua operasi
async function executeOperations() {
    try {
        await getPointsValue();
        await sendDeposit();
        await sendWithdraw(0.005);
        await getPointsValue();
    } catch (error) {
        console.error(chalk.red("Gagal terhubung ke RPC atau RPC tidak aktif:"), error);
    }
}

// Fungsi untuk menghitung waktu hingga jam 9 pagi
function getTimeUntilNextExecution() {
    const now = new Date();
    const nextExecution = new Date();

    nextExecution.setHours(9, 0, 0, 0); // Set ke jam 9 pagi

    // Jika sudah lewat jam 9 pagi, tambahkan satu hari
    if (now > nextExecution) {
        nextExecution.setDate(now.getDate() + 1);
    }

    return nextExecution - now; // Mengembalikan selisih waktu dalam milidetik
}

// Fungsi utama untuk loop 50 kali dan eksekusi setiap jam 9 pagi
async function main() {
    // Eksekusi langsung saat pertama kali run
    for (let i = 0; i < 50; i++) {
        await executeOperations();
        // Delay sejenak antara setiap operasi (misalnya 1 detik)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Setelah 50 kali, atur eksekusi harian
    while (true) {
        const delay = getTimeUntilNextExecution();
        await new Promise(resolve => setTimeout(resolve, delay));

        // Eksekusi operasi harian
        await executeOperations();
    }
}

main();
