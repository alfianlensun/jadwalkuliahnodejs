const baseUrl = 'https://jadwalkuliahapi.alfianlensun.dev'
const fastify = require('fastify')({
    logger: false
})
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath);

const mysql = require('mysql2/promise')
const moment = require('moment');
const fs = require('fs');
const axios = require('axios');
const path = require('path')
const util = require('util');
const audioconcat = require('audioconcat')
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname,'..', 'audio'),
    prefix: '/audio/',
})

const connection =  mysql.createPool({
    host: '165.22.60.214',
    user: 'root',
    password: 'root',
    database: 'db_reminder_kuliah',
    timezone: '+08:00'
});

fastify.get('/jadwal/stream', async function (request, reply) {
    const [rows, fields] = await connection.execute(`
        select * from trx_jadwal_kuliah as a 
        join mst_mata_kuliah  as b on a.id_mst_mata_kuliah = b.id_mst_mata_kuliah
        join mst_kelas as c on a.id_mst_kelas = c.id_mst_kelas
        join mst_dosen as d on a.id_mst_dosen = d.id_mst_dosen
        where 
        a.dow = ? 
        and 
        a.flag_active = 1
        and 
        (a.flag_panggil_mulai = 0 or a.flag_panggil_selesai = 0)
        order by jam_mulai asc
    `, [moment().day()]);

    if (rows.length == 0){
        return {
            status: false,
            url: null
        }
    }

    const writestream = fs.createWriteStream('audio/finalaudiotemp.mp3');
    const listStream = []
    

    const listjadwal = rows
    const texts = []

    
    for (const jadwal of listjadwal){
        if (jadwal.jam_mulai.substr(0, 5) == moment().format('HH:mm') && jadwal.flag_panggil_mulai == 0){
            texts.push({
                id: jadwal.id_trx_jadwal_kuliah,
                type: 'mulai',
                text: `Mata kuliah ${jadwal.nm_mst_mata_kuliah}; akan segera di mulai di kelas ${jadwal.nm_mst_kelas}.`
            })
        }

        if (jadwal.jam_selesai.substr(0, 5) == moment().format('HH:mm') && jadwal.flag_panggil_selesai == 0){
            texts.push({
                id: jadwal.id_trx_jadwal_kuliah,
                type: 'selesai',
                text: `Mata kuliah ${jadwal.nm_mst_mata_kuliah}; telah selesai di kelas ${jadwal.nm_mst_kelas}.`
            })   
        }
    }
    if (texts.length == 0){
        return {
            status: false,
            url: null
        }
    }
    const getIn = await axios.get(`${baseUrl}/audio/in.mp3`, {
        responseType: 'arraybuffer'
    })
    await fs.writeFileSync(`audio/audio_a.mp3`, getIn.data)
    listStream.push(`audio/audio_a.mp3`)
    for (let i = 0; i<texts.length; i++){
        const text = texts[i]
        const getAudio = await axios.get('http://translate.google.com/translate_tts', {
            params: {
                ie: 'UTF-8',
                client: 'tw-ob',
                tl: 'id',
                q: text.text
            },
            responseType: 'arraybuffer'
        })
        console.log(getAudio)
        await fs.writeFileSync(`audio/audio_${i}.mp3`, getAudio.data)
        listStream.push(`audio/audio_${i}.mp3`)
    }
    const getOut = await axios.get(`${baseUrl}/audio/out.mp3`, {
        responseType: 'arraybuffer'
    })
    await fs.writeFileSync(`audio/audio_b.mp3`, getOut.data)
    listStream.push(`audio/audio_b.mp3`)
    
    for (let i = 0; i<texts.length; i++){
        const text = texts[i]
        if (text.type == 'mulai'){
            await connection.execute(`
                update trx_jadwal_kuliah set flag_panggil_mulai = 1 where id_trx_jadwal_kuliah = ?
            `, [text.id]);
        }
        if (text.type == 'selesai'){
            await connection.execute(`
                update trx_jadwal_kuliah set flag_panggil_selesai = 1 where id_trx_jadwal_kuliah = ?
            `, [text.id]);
        }
    }
    if (fs.existsSync(path.join('audio', 'finalaudio.mp3'))){
        await fs.unlinkSync(path.join('audio', 'finalaudio.mp3'))
    }

    await new Promise((rs, rj) => {
        audioconcat(listStream)
            .concat('audio/finalaudio.mp3')
            .on('start', function (command) {
                console.log('ffmpeg process started:', command)
            })
            .on('error', function (err, stdout, stderr) {
                console.error('Error:', err)
                console.error('ffmpeg stderr:', stderr)
                rj()
            })
            .on('end', function (output) {
                console.error('Audio created in:', output)
                rs()
            })

    })
    return {
        status: true,
        url: `${baseUrl}/audio/finalaudio.mp3`
    }
})

const startServer = async () => {
    try {
        const host = '0.0.0.0'
        const port = 9999


        await fastify.listen({
            port, host
        })
        
        console.log(`server listening on ${host}:${fastify.server.address().port}`)        
        fastify.log.info(`server listening on ${fastify.server.address().port}`)
    } catch(err){
        fastify.log.error(err)
        console.log(err)
        process.exit(1)
    }
}

startServer()