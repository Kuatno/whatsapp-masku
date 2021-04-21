const express = require('express');
const { body, validationResult } = require('express-validator');
const qrcode = require('qrcode');
const { Client, MessageMedia } = require('whatsapp-web.js');
const socketIO = require('socket.io');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require ('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
	debug: true
}));

const SESSION_FILE_PATH = './wa-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

// -------------------------express------- //
app.get('/', (req, res) => {
	// // status
	// res.status(200).json({
	// 	status : true,
	// 	message: "Hallo WA Express"
	// });
	res.sendFile('index.html', { root: __dirname});
})
// -------------------------express------- //

const client = new Client({ 
	puppeteer: { 
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-stuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-accelerated-2d-canvas',
			'--no-first-run',
			'--no-zygote',
			'--single-process', // ini tidak bekerja di windows
			'--disable-gpu'
		],

		},
		session: sessionCfg
	});


args: [
	'--no-sandbox',
	'--disable-stuid-sandbox',
	'--disable-dev-shm-usage',
	'--disable-accelerated-2d-canvas',
	'--no-first-run',
	'--no-zygote',
	'--single-process', // ini tidak bekerja di windows
	'--disable-gpu'
]



// client.on('authenticated', (session) => {
//     console.log('AUTHENTICATED', session);
//     sessionCfg=session;
//     fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
//         if (err) {
//             console.error(err);
//         }
//     });
// });


// memunculkan QR Code di console
// client.on('qr', (qr) => {
// 	console.log('QR CODE RECEIVED', qr);
// });



// listen all message
client.on('message', message => {
	console.log(message.body);
});

// reply all message
client.on('message', message => {
	if(message.body === '!ping') {
		message.reply('pong');
	}
});

// reply specific message
client.on('message', message => {
	if(message.body == '!ping') {
		client.sendMessage(message.from, 'pong');
	}
	else if (message.body == 'Hallo') {
		client.sendMessage(message.from, 'Hi');
	}
	else if (message.body == 'Hallo Masku') {
		client.sendMessage(message.from, 'Hi Masku');
	}
	else if (message.body == 'Menu') {
		client.sendMessage(message.from, 'Hi Menu Sesuai Ini Yah');
	}
})

client.initialize();

// socket io
io.on('connection', (socket) =>{
	socket.emit('message', 'connecting...');
	
	// generate QR Code d Console Jika Belum Ready
	client.on('qr', qr => {
		console.log('QR RECEIVED', qr);
		qrcode.toDataURL(qr, (err, url) =>{
			socket.emit('qr', url);
			socket.emit('message', 'QR Code Diterima, Silahkan Scan !');
		});
	});

	// Status QR Code Ready
		// Status QR Code
	client.on('ready', () => {
		socket.emit('ready', 'Whatsapp Ready');
		socket.emit('message', 'Whatsapp Ready');
	});
	client.on('authenticated', (session) => {
		socket.emit('authenticated', 'Whatsapp is authenticated!');
		socket.emit('message', 'is authenticated!');
	    console.log('AUTHENTICATED', session);
	    sessionCfg=session;
	    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
	        if (err) {
	            console.error(err);
	        }
	    });
	});

// cek register number
const checkRegisterNumber = async function (number) {
	const isRegistered = await client.isRegisteredUser(number);
	return isRegistered;
}
// endpoint api express
// kirim pesan
app.post('/kirim-pesan', [
	body('number').notEmpty(),
	body('pesan').notEmpty(),

	], async (req, res) => {

	const errors = validationResult(req).formatWith(({ msg }) => {
		return msg;
	});
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: false,
			message: errors.mapped()
		})
	}
	const number = phoneNumberFormatter(req.body.number);
	const pesan = req.body.pesan;
	const isRegisteredNumber = await checkRegisterNumber(number);

	if (!isRegisteredNumber) {
		return res.status(422).json({
			status: false,
			message: 'Nomor Tidak Terdaftar Di Whatsapp'
		});
	}

	client.sendMessage(number, pesan).then(response => {
		res.status(200).json({
			status: true,
			response: response
		})

	}).catch(err => {
		res.status(500).json({
			status: false,
			response: err
		});
	});
});

});

// kirim media dengan media di local
app.post('/kirim-media-local', (req, res) => {
	const number = phoneNumberFormatter(req.body.number);
	const caption = req.body.caption;
	const media = MessageMedia.fromFilePath('./media/image2.png');

	client.sendMessage(number, media, { caption: caption }).then(response => {
		res.status(200).json({
			status: true,
			response: response
		})

	}).catch(err => {
		res.status(500).json({
			status: false,
			response: err
		});
	});
});

// kirim media file upload - npm i express-fileupload
app.post('/kirim-media-upload', (req, res) => {
	const number = phoneNumberFormatter(req.body.number);
	const caption = req.body.caption;
	// const media = MessageMedia.fromFilePath('./media/image1.png');

	const file = req.files.file;
	const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);

	client.sendMessage(number, media, { caption: caption }).then(response => {
		res.status(200).json({
			status: true,
			response: response
		})

	}).catch(err => {
		res.status(500).json({
			status: false,
			response: err
		});
	});
});

// kirim media file url - npm i axios
app.post('/kirim-media-url', async (req, res) => {
	const number = phoneNumberFormatter(req.body.number);
	const caption = req.body.caption;
	const fileUrl = req.body.file;
	// const media = MessageMedia.fromFilePath('./media/image1.png');

	// const file = req.files.file;
	// const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
	let mimetype;
	const attachment = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(response => {
		mimetype = response.headers['content-type'];
		return response.data.toString('base64');
	}); 


	const media = new MessageMedia(mimetype, attachment, 'Media');

	client.sendMessage(number, media, { caption: caption }).then(response => {
		res.status(200).json({
			status: true,
			response: response
		})

	}).catch(err => {
		res.status(500).json({
			status: false,
			response: err
		});
	});
});


const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`listen on port ${port}...`));