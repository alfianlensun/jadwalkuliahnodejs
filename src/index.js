const baseUrl = 'https://jadwalkuliahapi.alfianlensun.dev'
const fastify = require('fastify')({
    logger: false
})
const NodeCrunker = require('node-crunker');
const audio = new NodeCrunker();

const mysql = require('mysql2/promise')
const moment = require('moment');
const fs = require('fs');
const axios = require('axios');
const path = require('path')
const util = require('util');

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
    const writestream = fs.createWriteStream('audio/finalaudio.mp3');
    const listStream = [
        
    ]
    

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

    if (fs.existsSync(path.join('audio', 'finalaudio.mp3'))){
        fs.unlinkSync(path.join('audio', 'finalaudio.mp3'))
    }
    

    
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
        await fs.writeFileSync(`audio/audio_${i}.mp3`, getAudio.data)
        listStream.push(fs.createReadStream(`audio/audio_${i}.mp3`))
    }
    
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
    
    
    for (const stream of listStream){
        stream.pipe(writestream)
    }
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