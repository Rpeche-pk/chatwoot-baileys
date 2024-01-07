const chalk = require('chalk');
const fs = require('fs');
class BlackList {


    constructor() {
        if (BlackList.instance) {
            return BlackList.instance;
        }
        BlackList.instance = this;
    }

    addBlackList(phone) {
    
        let content = [];
        try {
            content = JSON.parse(fs.readFileSync('blackList.json', 'utf8'));
        } catch (error) {
            // Si el archivo no existe o no se puede parsear, inicializar la lista
            content = [];
        }
    
        // Verificar si el número ya está en la lista
        if (content.includes(phone)) {
            console.log(`El número ${phone} ya está en la lista negra.`);
        } else {
            // Agregar el número a la lista
            content.push(phone);
    
            // Guardada en el archivo
            fs.writeFileSync('blackList.json', JSON.stringify(content, null, 2));
            console.log(`El número ${phone} ha sido agregado a la lista negra.`);
        }
    }
    
    removeBlackList(phone) {
        let content = [];
        try {
            content = JSON.parse(fs.readFileSync('blackList.json', 'utf8'));
        } catch (error) {
            // Si el archivo no existe o no se puede parsear, inicializar la lista
            content = [];
        }
    
        // Verificar si el número ya está en la lista
        if (content.includes(phone)) {
            // Eliminar el número de la lista
            content = content.filter((item) => item !== phone);
    
            // Guardada en el archivo
            fs.writeFileSync('blackList.json', JSON.stringify(content, null, 2));
            console.log(`El número ${phone} ha sido eliminado de la lista negra.`);
        } else {
            console.log(`El número ${phone} no está en la lista negra.`);
        }
    }

    getBlackList() {
        let content = [];
        try {
            console.log(chalk.bgCyan('leyendo archivo de la black list'));
            content = JSON.parse(fs.readFileSync('blackList.json', 'utf8'));
        } catch (error) {
            content = [];
        }
        return content;
    }
}

const black = new BlackList();
module.exports = {black};