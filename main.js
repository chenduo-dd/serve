const http = require('http')
const url = require('url')
const path = require('path')
const mime = require('mime')
const ejs = require('ejs')
const { promisify } = require('util')
const fs = require('fs').promises
const { createReadStream } = require('fs')


function mergeConfig(config) {
    return {
        port: 1234,
        directory: process.cwd(),
        ...config
    }
}

class Server {
    constructor(config) {
        this.config = mergeConfig(config)
    }
    start() {
        let server = http.createServer(this.serveHandle.bind(this))
        server.listen(this.config.port, () => {
            console.log('服务端已经启动了')
        })
    }
    async serveHandle(req, res) {
        let { pathname } = url.parse(req.url)
        pathname = decodeURIComponent(pathname)
        let abspath = path.join(this.config.directory, pathname)
        try {
            let statObj = await fs.stat(abspath)
            if (statObj.isFile()) {
                this.fileHandle(req, res, abspath)
            } else {
                let dirs = await fs.readdir(abspath)
                dirs = await Promise.all(
                    dirs.map(async item => {
                        const itemPath = path.join(pathname, item)
                        const itemAbspath = path.resolve(abspath, item)
                        let itemStat = await fs.stat(itemAbspath)
                        return {
                            path: itemPath,
                            dirs: item,
                            isFile: itemStat.isFile()
                        }
                    })
                )
                let renderFile = promisify(ejs.renderFile)
                let parentPath = path.dirname(pathname)
                let ret = await renderFile(path.resolve(__dirname, 'template.html'), {
                    arr: dirs,
                    parent: pathname !== '/',
                    parentPath,
                    title: path.basename(abspath)
                })
                res.end(ret)
            }
        } catch (err) {
            this.errorHandle(req, res, err)
        }
    }
    fileHandle(req, res, abspath) {
        res.statusCode = 200
        res.setHeader('Content-type', `${mime.getType(abspath)};charset=utf-8`)
        createReadStream(abspath).pipe(res)
    }
    errorHandle(req, res, err) {
        console.log(err)
        res.statusCode = 404
        res.setHeader('Content-type', 'text/html;charset=utf-8')
        res.end('not found')
    }
}

module.exports = Server