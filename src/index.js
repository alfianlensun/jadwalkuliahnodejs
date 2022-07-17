const fastify = require('fastify')({
    logger: false
})
const mysql = require('mysql2/promise')
const googleTTS = require('google-tts-api');
const moment = require('moment');

fastify.get('/jadwal/stream', async function (request, reply) {
    const connection = await mysql.createConnection({
        host: '192.168.1.3',
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
    if (jadwal.jam_mulai.substr(0, 5) == moment().format('HH:mm')){
        const [result = null] = googleTTS.getAllAudioUrls(`Mata kuliah ${jadwal.nm_mst_mata_kuliah}; akan segera di mulai di kelas ${jadwal.nm_mst_kelas}.`, {
            lang: 'id',
            slow: false,
            host: 'https://translate.google.com',
            splitPunct: ',.?',
        }) 
        return {
            status: true,
            url: result.url
        }
    }
    if (jadwal.jam_selesai.substr(0, 5) == moment().format('HH:mm')){
        const [result = null] = googleTTS.getAllAudioUrls(`Mata kuliah ${jadwal.nm_mst_mata_kuliah}; telah selesai di kelas ${jadwal.nm_mst_kelas}.`, {
            lang: 'id',
            slow: false,
            host: 'https://translate.google.com',
            splitPunct: ',.?',
        }) 
        return {
            status: true,
            url: result.url
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