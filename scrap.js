import puppeteer from "puppeteer";
import { getFilteredElements } from "./functions.js";

async function openWebPage() {
  const browser = await puppeteer.launch({
    // headless: true,
    headless: false,
    // slowMo: 100,
    // dumpio: true,
    // timeout:60000
  })

  const page = await browser.newPage();

  const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';
  await page.setUserAgent(customUA);

  await page.goto("https://icd.who.int/browse/2024-01/mms/es");

  await Promise.all([
    page.waitForSelector('.topul'),
    page.waitForSelector('.node'),
    page.waitForSelector('.labelinh')
  ])

  //Esperamos 1s para que cargue bien la página
  await new Promise(r => (setTimeout(r, 1000)))

  let content = [] //Donde se almacenará la data final
  let elements = await getFilteredElements(page) //28 (obtenemos los .collapsed)
  let elementsParent = []
  //NOTE: Capítulos
  for (let i = 0; i < elements.length; i++) {
    const obt = await elements[i].evaluate((e) => {
      return {
        chapter: e.parentElement.nextElementSibling.querySelector(".codeinh").innerText,
        range: "",
        title: e.parentElement.nextElementSibling.querySelector(".titleinh").innerText.trim()
      }
    })
    const eleP = await elements[i].evaluateHandle((e) => {
      return e.parentElement
    })
    elementsParent.push(eleP)
    content.push(obt)
    await elements[i].click();
  }

  //NOTE: Sections
  await new Promise(r => (setTimeout(r, 2000)))

  for (let i = 0; i < content.length; i++) {

    let js = await elementsParent[i].evaluateHandle((e) => {
      return e.parentElement.lastChild
    })

    const sections = await js.$$('span.labelinh')
    const section = []

    //recorremos los sections para optener el innerText (titulos de los sections)
    for (const item of sections) {
      const obj = await item.evaluate((e) => {
        let title = e.firstChild.querySelector("span.titleinh").innerText.trim()
        let flag = e.firstChild.className != "nodeAdoptedChild" && e.firstChild.className != "nodeWindow"
        let code = e.firstChild.querySelector("span.codeinh").innerText.trim()
        if (code != "") title.replace(code, "")
        return { title, flag }
      })
      if (obj.flag)
        section.push(obj.title)
    }
    content[i].sections = section

    //Recorremos las secciones (Contienen los titulos) para obtener los .collapsed y hacerles click
    //si no existe o es un .nodeAdoptedChild retornamos nulo
    for (let j = 0; j < sections.length; j++) {
      let collapsedHandle = await sections[j].evaluateHandle((e) => {
        if (e.firstChild.className != "nodeAdoptedChild" && e.previousSibling.className != "empty")
          return e.previousSibling.firstChild
        return null
      })
      let flagCollapsedHandle = await collapsedHandle.jsonValue()
      if (flagCollapsedHandle != null) {
        await collapsedHandle.click();
      }
      await collapsedHandle.dispose();


      //Esperamos 1s para que cargue bien
      await new Promise(r => (setTimeout(r, 1000)))
      //Categories
      //Categoies unicamente de la seccion actual
      let parm = await sections[j].evaluateHandle((e) => e.nextElementSibling)

      //Filtramos (Impedimos) los .collapsed que no han sido desplegados debido a que son .nodeAdoptedChild
      const flag_param = await parm.jsonValue()
      if (flag_param != null) {
        let categories_coll = await getFilteredElements(parm)

        //click a las que no tengan
        while (categories_coll.length > 0) {

          for (let ct = 0; ct < categories_coll.length; ct++) {
            const cateHandle = await categories_coll[ct].evaluateHandle((e) => {
              if (e.parentElement.nextElementSibling.firstChild.className != "nodeAdoptedChild")
                return e
            })
            let flagCate = await cateHandle.jsonValue()
            if (flagCate != null)
              await categories_coll[ct].click()
          }
          await new Promise(r => (setTimeout(r, 1500)))
          categories_coll = await getFilteredElements(parm)

        }

        await parm.dispose()

        //Obtener Titulos y codigos:
        let obj = await sections[j].evaluateHandle((e) => e.nextElementSibling)
        let elements = await obj.$$('span.codeinh');
        const contenedor = []
        for (const ele of elements) {
          let cos = await ele.evaluate((e) => {
            let obj1 = e.innerText.trim()
            let obj2 = e.nextElementSibling.innerText.trim()
            if (obj1 != "") return { code: obj1, title: obj2 }
          })
          if (cos != undefined)
            contenedor.push(cos)
        }
        content[i].sections[j] = { sec: content[i].sections[j], obj: contenedor }

        // console.dir(content[i].sections[j])
      }
    }
     
  }
  console.log(content)
  await browser.close();
}
openWebPage()

