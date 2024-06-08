export async function getFilteredElements(page) {
    let elements = await page.$$('span.collapsed');
    const filteredElements = await Promise.all(elements.map(async (n) => {
      const isValid = await n.evaluate((e) => {
        return e.parentElement.nextElementSibling.firstChild.className !== "nodeAdoptedChild";
      });
      return isValid ? n : null;
    }));
    elements = filteredElements.filter(n => n !== null);
    return elements
}

