import { DOMParser } from "@xmldom/xmldom";

const MAX_DOCUMENT_XML_BYTES = 512 * 1024;

class DigiLockerDocumentError extends Error {
  constructor(code, validationReason = null) {
    super("DigiLocker document could not be validated");
    this.name = "DigiLockerDocumentError";
    this.code = code;
    if (typeof validationReason === "string") this.validationReason = validationReason;
  }
}

function normalizeXmlInput(input, invalidDocumentCode = "INVALID_DOCUMENT") {
  let xml;
  if (typeof input === "string") {
    xml = input;
  } else if (Buffer.isBuffer(input)) {
    if (input.byteLength > MAX_DOCUMENT_XML_BYTES) {
      throw new DigiLockerDocumentError(invalidDocumentCode, "document_size_limit_exceeded");
    }
    try {
      xml = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      throw new DigiLockerDocumentError(invalidDocumentCode, "xml_encoding_invalid");
    }
  } else {
    throw new DigiLockerDocumentError(invalidDocumentCode, "input_type_invalid");
  }
  if (Buffer.byteLength(xml, "utf8") > MAX_DOCUMENT_XML_BYTES) {
    throw new DigiLockerDocumentError(invalidDocumentCode, "document_size_limit_exceeded");
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new DigiLockerDocumentError(invalidDocumentCode, "doctype_or_entity_forbidden");
  }
  return xml;
}

function parseXml(input, invalidDocumentCode = "INVALID_DOCUMENT") {
  const xml = normalizeXmlInput(input, invalidDocumentCode);
  let malformed = false;
  let document;
  try {
    document = new DOMParser({
      onError(level) {
        if (level === "error" || level === "fatalError") malformed = true;
      },
    }).parseFromString(xml, "application/xml");
  } catch {
    throw new DigiLockerDocumentError(invalidDocumentCode, "parser_exception");
  }
  if (malformed) throw new DigiLockerDocumentError(invalidDocumentCode, "malformed_xml");
  if (!document?.documentElement) {
    throw new DigiLockerDocumentError(invalidDocumentCode, "root_element_missing");
  }
  return document;
}

function directChildrenByName(node, localName) {
  const matches = [];
  for (let child = node?.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1 && child.localName === localName && child.namespaceURI === node.namespaceURI) {
      matches.push(child);
    }
  }
  return matches;
}

function descendantsByName(node, localName, namespaceUri) {
  const matches = [];
  const visit = (current) => {
    for (let child = current?.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue;
      if (
        child.localName === localName &&
        (namespaceUri === undefined || child.namespaceURI === namespaceUri)
      ) matches.push(child);
      visit(child);
    }
  };
  visit(node);
  return matches;
}

function getAttribute(element, name) {
  return element?.getAttribute(name)?.trim() || "";
}

export {
  DigiLockerDocumentError,
  directChildrenByName,
  descendantsByName,
  getAttribute,
  normalizeXmlInput,
  parseXml,
};
