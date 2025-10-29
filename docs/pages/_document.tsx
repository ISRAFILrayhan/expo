styles.nameitem.imgitem.id766item.namehttps://i.ibb.co/JxK4Gf0/noisefit.jpghttps://i.ibb.co/9bGc5fS/macbookair.jpghttps://i.ibb.co/3czcDzw/redmi13pro.jpghttps://i.ibb.co/Zh6XsfZ/iphone15.jpg18999932999184999https://i.ibb.co/tLJ5vRn/s24ultra.jpg13999908ce1904-b629-4140-982d-8cc3f1c2194dimport { BlockingSetInitialColorMode } from '@expo/styleguide';
import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

export default class DocsDocument extends Document {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      styles: <>{initialProps.styles}</>,
    };
  }

  render() {
    return (
      <Html lang="en">
        <Head />
        <body className="text-pretty">
          <BlockingSetInitialColorMode />
          <Main />
          <NextScript />
        </body>
      </Html>
      
