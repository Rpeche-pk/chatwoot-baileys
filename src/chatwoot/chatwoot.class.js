const chalk = require("chalk");
const { log } = require("console");
const { readFile } = require("fs/promises");
class ChatwootClass {
  config = {
    account: undefined,
    token: undefined,
    endpoint: undefined,
  };

  /**
   * Recibir todos los parametro de configuracio de conexion con chatwoot
   */
  constructor(_config = {}) {
    if (!_config?.account) {
      throw new Error("ACCOUNT_ERROR");
    }

    if (!_config?.token) {
      throw new Error(`TOKEN_ERROR`);
    }

    if (!_config?.endpoint) {
      throw new Error(`ENDPOINT_ERROR`);
    }

    this.config = _config;
  }

  /**
   * [utility]
   * Formateo del formato del numero +51 966....
   * @param {*} number
   * @returns
   */
  formatNumber = (number) => {
    if (!number.startsWith("+")) {
      return `+${number}`;
    }
    return number;
  };

  /**
   * [utility]
   * Esta funciona nos ayuda a crear un encabezado con la authorization del token
   * @returns
   */
  buildHeader = () => {
    const headers = new Headers();
    headers.append("api_access_token", process.env.CHATWOOT_TOKEN);
    headers.append("Content-Type", "application/json");
    return headers;
  };

  /**
   * [utility]
   * Esto nos ayuda a construir un url base
   * @param {*} path
   * @returns
   */
  buildBaseUrl = (path) => {
    return `${this.config.endpoint}/api/v1/accounts/${this.config.account}${path}`;
  };

  /**
   * [CONTACT]
   * https://www.chatwoot.com/developers/api/#tag/Contacts/operation/contactSearch
   * https://chatwoot-production-e265.up.railway.app/api/v1/accounts/1/contacts/search?q=+359987499
   * @param {*} from numero de telefono
   * @returns [] array
   */
  findContact = async (from) => {
    try {
      const url = this.buildBaseUrl(`/contacts/search?q=${from}`);

      const dataFetch = await fetch(url, {
        headers: this.buildHeader(),
        method: "GET",
      });

      const data = await dataFetch.json();
      return data.payload[0];
    } catch (error) {
      console.error(`[Error searchByNumber]`, error);
      return [];
    }
  };

  /**
   * [CONTACT]
   *  Crear un contacto
   * @param {*} dataIn
   * @returns
   */
  createContact = async (dataIn = { from: "", name: "", inbox: "" }) => {
    try {
      dataIn.from = this.formatNumber(dataIn.from);

      const data = {
        inbox_id: dataIn.inbox,
        name: dataIn.name,
        phone_number: dataIn.from,
        //creamos una lista de atributos personalizados nivel contacto
        custom_attributes: { whatsapp: dataIn.from},
      };

      const url = this.buildBaseUrl(`/contacts`);

      const dataFetch = await fetch(url, {
        headers: this.buildHeader(),
        method: "POST",
        body: JSON.stringify(data),
      });

      const response = await dataFetch.json();
      return response.payload.contact;
    } catch (error) {
      console.error(`[Error createContact]`, error);
      return;
    }
  };

  /**
   * [CONTACT]
   * Buscar o crear contacto
   * @param {*} dataIn
   * @returns
   */
  findOrCreateContact = async (dataIn = { from: "", name: "", inbox: "" }) => {
    try {
      dataIn.from = this.formatNumber(dataIn.from);
      const getContact = await this.findContact(dataIn.from);
      if (!getContact) {
        const contact = await this.createContact(dataIn);
        return contact;
      }
      return getContact;
    } catch (error) {
      console.error(`[Error findOrCreateContact]`, error);
      return;
    }
  };

  /**
   * [CONVERSATION]
   * Importante crear este atributo personalizado en el chatwoot
   * Crear conversacion
   * @param {*} dataIn
   * @returns
   */
  createConversation = async (dataIn = { inbox_id: "", contact_id: "", phone_number: "" }) => {
    try {
      dataIn.phone_number = this.formatNumber(dataIn.phone_number);

      const payload = {
        custom_attributes: { 
            phone_number: dataIn.phone_number 
        },
        status: "open",
      };

      const url = this.buildBaseUrl(`/conversations`);
      const dataFetch = await fetch(url, {
        method: "POST",
        headers: this.buildHeader(),
        body: JSON.stringify({ ...dataIn, ...payload }),
      });
      const data = await dataFetch.json();
      return data;
    } catch (error) {
      console.error(`[Error createConversation]`, error);
      return;
    }
  };

  /**
   * [CONVERSATION]
   * Buscar si existe una conversacion previa
   * @param {*} dataIn
   * @returns
   */
  findConversation = async (dataIn = { phone_number: "" }) => {
    try {
      dataIn.phone_number = this.formatNumber(dataIn.phone_number);

      /*const payload = [
                {
                    //todo aqui recuperamos dicho atributo para filtrarlo en la busqueda
                    attribute_key: "phone_number",
                    attribute_model: "standard",
                    filter_operator: "equal_to",
                    values: [dataIn.phone_number],
                    custom_attribute_type: "",
                },
            ];

            const url = this.buildBaseUrl(`/conversations/filter`)

            const dataFetch = await fetch(url,
                {
                    method: "POST",
                    headers: this.buildHeader(),
                    body: JSON.stringify({ payload }),
                }
            );
            console.log("FIND CONVERSATION", dataFetch);


            const data = await dataFetch.json();*/
      const url = this.buildBaseUrl(`/conversations`);
      const dataFetch = await fetch(url, {
        headers: this.buildHeader(),
        method: "GET",
      });
      const conversation = await dataFetch.json();
      const existConversation = conversation.data.payload.find(
        (conversation) => conversation.meta.sender.phone_number === dataIn.phone_number
      );
      if (!existConversation) {
        return;
      }

      return existConversation;
    } catch (error) {
      console.error(`[Error findConversation]`, error);
      return;
    }
  };

  /**
   * [CONVERSATION]
   * Buscar o Crear conversacion
   * @param {*} dataIn
   * @returns
   */
  findOrCreateConversation = async (dataIn = { inbox_id: "", contact_id: "", phone_number: "" }) => {
    try {
      dataIn.phone_number = this.formatNumber(dataIn.phone_number);
      const getId = await this.findConversation(dataIn);
      if (!getId) {
        console.log(chalk.bgGreen("<<<<<Creando conversacion para el usuario>>>>>"),chalk.cyanBright(dataIn.phone_number));
        const conversationId = await this.createConversation(dataIn);
        return conversationId;
      }
      return getId;
    } catch (error) {
      console.error(`[Error findOrCreateInbox]`, error);
      return;
    }
  };

  /**
   * Esta funcion ha sido modificada para poder enviar archivos multimedia y texto
   * [messages]
   * @param {mode}  "incoming" | "outgoing"
   * @param {*} dataIn
   * @returns
   */
  createMessage = async (dataIn = { msg: "", mode: "", conversation_id: "", attachment: [] }) => {
    try {
      const url = this.buildBaseUrl(`/conversations/${dataIn.conversation_id}/messages`);
      const form = new FormData();

      form.set("content", dataIn.msg);
      form.set("message_type", dataIn.mode);
      form.set("private", "true");
      form.set("Content-Disposition", "inline");

      if (dataIn.attachment?.length) {
        const fileName = `${dataIn.attachment[0]}`.split("/").pop();
        const blob = new Blob([await readFile(dataIn.attachment[0])]);
        form.set("attachments[]", blob, { filename: fileName });
      }
      const dataFetch = await fetch(url, {
        method: "POST",
        headers: {
          api_access_token: this.config.token,
        },
        body: form,
      });
      const data = await dataFetch.json();
      return data;
    } catch (error) {
      console.error(`[Error createMessage]`, error);
      return;
    }
  };

  /**
   * [inboxes]
   * Crear un inbox si no existe
   * @param {*} dataIn
   * @returns
   */
  createInbox = async (dataIn = { name: "" }) => {
    try {
      const payload = {
        name: dataIn.name,
        channel: {
          type: "api",
          webhook_url: "",
        },
      };

      const url = this.buildBaseUrl(`/inboxes`);
      const dataFetch = await fetch(url, {
        headers: this.buildHeader(),
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await dataFetch.json();
      return data;
    } catch (error) {
      console.error(`[Error createInbox]`, error);
      return;
    }
  };

  /**
   * [inboxes]
   * Buscar si existe un inbox creado
   * @param {*} dataIn
   * @returns
   */
  findInbox = async (dataIn = { name: "" }) => {
    try {
      const url = this.buildBaseUrl(`/inboxes`);
      const dataFetch = await fetch(url, {
        headers: this.buildHeader(),
        method: "GET",
      });

      const data = await dataFetch.json();
      const payload = data.payload;

      const checkIfExist = payload.find((o) => o.name === dataIn.name);

      if (!checkIfExist) {
        return;
      }

      return checkIfExist;
    } catch (error) {
      console.error(`[Error findInbox]`, error);
      return;
    }
  };

  /**
   * [inboxes]
   * Buscar o crear inbox
   * @param {*} dataIn
   * @returns
   */
  findOrCreateInbox = async (dataIn = { name: "" }) => {
    try {
      const getInbox = await this.findInbox(dataIn);
      if (!getInbox) {
        const idInbox = await this.createInbox(dataIn);
        return idInbox;
      }
      return getInbox;
    } catch (error) {
      console.error(`[Error findOrCreateInbox]`, error);
      return;
    }
  };


  // TODO 👇🏼👇🏼👇🏼👇🏼 ESTAs funciones son algunos endpoint de chatwoot para usarlo A FUTURO 👇🏼👇🏼👇🏼👇🏼
  /**
   * [custom_attributes]
   * Establece los atributos personalizados del usuario en Chatwoot.
   * @param {string} userPhone - Número de teléfono del usuario.
   * @param {string} field - Campo a actualizar.
   * @param {Object} attributes - Atributos a establecer.
   */
  async setAttributes(userPhone, field, attributes) {
    const userID = await this.getUserID(userPhone);
    const url =this.buildBaseUrl(`/contacts/${userID}`)
    const dataFetch = await fetch(url, {
      method: "PUT",
      headers: this.buildHeader(),
      body: { custom_attributes: { [field]: attributes } },
    });
    return true;
  }

  async createAttributes() {
    const data = {
      attribute_display_name: "Funciones del Bot", // Nombre visible del atributo.
      attribute_display_type: 6, // Tipo de visualización: Lista.
      attribute_description: "Control para las funciones del bot", // Descripción del atributo.
      attribute_key: "funciones_del_bot", // Clave única para el atributo.
      attribute_values: ["On", "Off"], // Posibles valores para el atributo.
      attribute_model: 1, // Tipo de modelo: Contacto.
    };
    const url = this.buildBaseUrl(`/custom_attribute_definitions`);
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeader(),
      body: JSON.stringify(data)
    });

    return response;
  }

  searchByNumber = async (phone) => {
    const requestOptions = {
      method: "GET",
      headers: this.buildHeader(),
    };

    const dataAPI = await fetch(
      `${this.api}/api/v1/accounts/${this.config.account}/contacts/search?include_contact_inboxes=false&page=1&sort=-last_activity_at&q=${phone}`,
      requestOptions
    );
    const data = await dataAPI.json();
    console.log(data.payload);
    return data.payload;
  };
}

module.exports = ChatwootClass;
