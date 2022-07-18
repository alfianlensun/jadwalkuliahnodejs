const baseUrl = 'http://localhost:9999'
const fastify = require('fastify')({
    logger: false
})

const mysql = require('mysql2/promise')
const googleTTS = require('google-tts-api');
const moment = require('moment');
const fs = require('fs');
const axios = require('axios');
const path = require('path')
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname,'..', 'audio'),
    prefix: '/audio/',
})


fastify.get('/jadwal/stream', async function (request, reply) {
      
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'root',
        database: 'db_reminder_kuliah',
        timezone: 'Asia/Makassar'
    });

    const [rows, fields] = await connection.execute(`
        select * from trx_jadwal_kuliah as a 
        join mst_mata_kuliah  as b on a.id_mst_mata_kuliah = b.id_mst_mata_kuliah
        join mst_kelas as c on a.id_mst_kelas = c.id_mst_kelas
        join mst_dosen as d on a.id_mst_dosen = d.id_mst_dosen
        where 
        a.tanggal = ? 
        and 
        a.flag_active = 1
        and 
        a.flag_panggil = 0
        order by jam_mulai asc
        limit 1
    `, [moment().format('YYYY-MM-DD')]);

    if (rows.length == 0){
        return {
            status: false,
            url: null
        }
    }

    const [jadwal] = rows
    console.log(jadwal.jam_mulai.substr(0, 5) == moment().format('HH:mm'))
    if (jadwal.jam_mulai.substr(0, 5) == moment().format('HH:mm')){
        const texts = [
            `Mata kuliah ${jadwal.nm_mst_mata_kuliah}; akan segera di mulai di kelas ${jadwal.nm_mst_kelas}.`
        ]
        const listStream = []
        let writestream = fs.createWriteStream('audio/finalaudio.mp3');
        for (let i = 0; i<texts.length; i++){
            const text = texts[i]
            const getAudio = await axios.get('http://translate.google.com/translate_tts', {
                params: {
                    ie: 'UTF-8',
                    client: 'tw-ob',
                    tl: 'id',
                    q: text
                },
                responseType: 'arraybuffer'
            })
        
            await fs.writeFileSync(`audio/audio_${i}.mp3`, getAudio.data)

            listStream.push(fs.createReadStream(`audio/audio_${i}.mp3`))
        }

        for (const stream of listStream){
            stream.pipe(writestream)
        }

        return {
            status: true,
            url: `${baseUrl}/audio/finalaudio.mp3`
        }
    }
    if (jadwal.jam_selesai.substr(0, 5) == moment().format('HH:mm')){

        const texts = [
            `Mata kuliah ${jadwal.nm_mst_mata_kuliah}; telah selesai di kelas ${jadwal.nm_mst_kelas}.`
        ]
        const listStream = []
        let writestream = fs.createWriteStream('finalaudio.mp3');
        for (let i = 0; i<texts.length; i++){
            const text = texts[i]
            const getAudio = await axios.get('http://translate.google.com/translate_tts', {
                params: {
                    ie: 'UTF-8',
                    client: 'tw-ob',
                    tl: 'id',
                    q: text
                },
                responseType: 'arraybuffer'
            })
        
            await fs.writeFileSync(`audio/audio_${i}.mp3`, getAudio.data)

            listStream.push(fs.createReadStream(`audio/audio_${i}.mp3`))
        }

        for (const stream of listStream){
            stream.pipe(writestream)
        }
        return {
            status: true,
            url: `${baseUrl}/audio/finalaudio.mp3`
        }
    }
    
    return {
        status: false,
        url: null
    }
})

const startServer = async () => {
    try {
        const host = '0.0.0.0'
        const port = 9999


        await fastify.listen(port, host)
        
        console.log(`server listening on ${host}:${fastify.server.address().port}`)        
        fastify.log.info(`server listening on ${fastify.server.address().port}`)
    } catch(err){
        fastify.log.error(err)
        console.log(err)
        process.exit(1)
    }
}

startServer()