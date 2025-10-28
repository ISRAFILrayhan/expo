/**
 * Copyright © 2025 650 Industries.
 */

import * as babel from '@babel/core';

import preset from '..';

const CLIENT_CALLER = {
  name: 'metro',
  isDev: false,
  isServer: false,
  platform: 'web',
  projectRoot: '/',
  supportsStaticESM: true,
};

const SERVER_CALLER = {
  name: 'metro',
  isDev: false,
  isServer: true,
  platform: 'web',
  projectRoot: '/',
  supportsStaticESM: true,
};

function getCaller(props: Record<string, string | boolean>): babel.TransformCaller {
  return props as unknown as babel.TransformCaller;
}

const DEF_OPTIONS = {
  // Ensure this is absolute to prevent the filename from being converted to absolute and breaking CI tests.
  filename: '/unknown',
  babelrc: false,
  presets: [preset],
  sourceMaps: true,
  configFile: false,
  compact: false,
  comments: true,
  retainLines: false,
};

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, FORCE_COLOR: '0' };
});

afterAll(() => {
  process.env = { ...originalEnv };
});

function transformTest(code: string, isServer = false) {
  const options = {
    ...DEF_OPTIONS,
    caller: getCaller(isServer ? SERVER_CALLER : CLIENT_CALLER),
  };

  const results = babel.transform(code, options);
  if (!results) throw new Error('Failed to transform code');

  return {
    code: results.code,
    metadata: results.metadata,
  };
}

describe('export function loader()', () => {
  it('removes export async function loader from client bundles', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export async function loader() {
        return { data: 'test' };
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('removes export function loader (non-async)', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export function loader() {
        return { data: 'test' };
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });
});

describe('export const loader = () => {}', () => {
  it('removes export const loader = async () => {}', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export const loader = async () => {
        return { data: 'test' };
      };

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('removes export const loader = () => {}', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export const loader = () => {
        return { data: 'test' };
      };

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });
});

describe('export const loader = function() {}', () => {
  it('removes export const loader = async function() {}', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export const loader = async function() {
        return { data: 'test' };
      };

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('removes export const loader = function() {}', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export const loader = function() {
        return { data: 'test' };
      };

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });
});

describe('dead code elimination', () => {
  it('removes imports only used by loader', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { serverOnlyUtil } from './server-utils';
      import { clientUtil } from './client-utils';

      export async function loader() {
        return serverOnlyUtil();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data} {clientUtil()}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { clientUtil } from './client-utils';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data, " ", clientUtil()]
        });
      }"
    `);
  });

  it('removes helper functions only called by loader', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      function helperOnlyForLoader() {
        return 'data';
      }

      function sharedHelper() {
        return 'shared';
      }

      export async function loader() {
        return helperOnlyForLoader();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data} {sharedHelper()}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      function sharedHelper() {
        return 'shared';
      }
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data, " ", sharedHelper()]
        });
      }"
    `);
  });

  it('removes variables only referenced by loader', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      const loaderOnlyVar = 'server-only';
      const sharedVar = 'shared';

      export async function loader() {
        return { data: loaderOnlyVar };
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data} {sharedVar}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      const sharedVar = 'shared';
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data.data, " ", sharedVar]
        });
      }"
    `);
  });

  it('removes transitive dependencies', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { A } from './a';

      function B() {
        return A();
      }

      function C() {
        return B();
      }

      export async function loader() {
        return C();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data
        });
      }"
    `);
  });

  it('removes multiple imports from same source when unused', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { util1, util2, util3 } from './utils';

      export async function loader() {
        return util1() + util2();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data} {util3()}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { util3 } from './utils';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data, " ", util3()]
        });
      }"
    `);
  });

  it('removes default imports only used by loader', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import serverUtil from './server-utils';
      import clientUtil from './client-utils';

      export async function loader() {
        return serverUtil();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data} {clientUtil()}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import clientUtil from './client-utils';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data, " ", clientUtil()]
        });
      }"
    `);
  });

  it('removes namespace imports only used by loader', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import * as serverUtils from './server-utils';
      import * as clientUtils from './client-utils';

      export async function loader() {
        return serverUtils.getData();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data} {clientUtils.render()}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import * as clientUtils from './client-utils';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data, " ", clientUtils.render()]
        });
      }"
    `);
  });

  it('removes multiple helper functions and their imports', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { db } from './db';

      async function getUser(id) {
        return db.user.find(id);
      }

      async function getUserPosts(userId) {
        return db.posts.where({ userId });
      }

      export async function loader({ params }) {
        const user = await getUser(params.id);
        const posts = await getUserPosts(user.id);
        return { user, posts };
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.user}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.user
        });
      }"
    `);
  });
});

describe('preserves', () => {
  it('preserves loader in server bundles', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export async function loader() {
        return { data: 'test' };
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        true
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export async function loader() {
        return {
          data: 'test'
        };
      }
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('preserves code used by both loader and component', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { sharedUtil } from './utils';

      export async function loader() {
        return sharedUtil();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data} {sharedUtil()}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { sharedUtil } from './utils';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data, " ", sharedUtil()]
        });
      }"
    `);
  });

  it('preserves default export', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export async function loader() {
        return { data: 'test' };
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('preserves other named exports', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export async function loader() {
        return { data: 'test' };
      }

      export const unstable_settings = { anchor: 'index' };

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export const unstable_settings = {
        anchor: 'index'
      };
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('preserves multiple exports in same declaration', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      export const loader = async () => {
        return { data: 'test' };
      }, unstable_settings = { anchor: 'index' }, generateStaticParams = () => ([
        { id: '1' }, { id: '2' }
      ]);

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export const unstable_settings = {
          anchor: 'index'
        },
        generateStaticParams = () => [{
          id: '1'
        }, {
          id: '2'
        }];
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('preserves imports used by other exports', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { getStaticParams } from './utils';

      export async function loader() {
        return { data: 'test' };
      }

      export async function generateStaticParams() {
        return getStaticParams();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { getStaticParams } from './utils';
      import { jsx as _jsx } from "react/jsx-runtime";
      export async function generateStaticParams() {
        return getStaticParams();
      }
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data.data
        });
      }"
    `);
  });

  it('preserves functions used by both loader and component', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';
      import { formatDate } from './utils';
      import { fetchData } from './api';

      export async function loader() {
        const data = await fetchData();
        return { date: formatDate(data.timestamp) };
      }

      export default function Index() {
        const data = useLoaderData();
        const date = new Date();
        return <div>{data.date} {formatDate(date)}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { formatDate } from './utils';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        const date = new Date();
        return /*#__PURE__*/_jsxs("div", {
          children: [data.date, " ", formatDate(date)]
        });
      }"
    `);
  });

  it('preserves constants used in both loader and component', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      const API_URL = 'https://api.example.com';

      export async function loader() {
        const response = await fetch(API_URL);
        return response.json();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.status} API: {API_URL}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      const API_URL = 'https://api.example.com';
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data.status, " API: ", API_URL]
        });
      }"
    `);
  });

  it('preserves side-effect imports', () => {
    expect(
      transformTest(
        `
      import 'side-effect';
      import { useLoaderData } from 'expo-router';

      export async function loader() {
        const response = await fetch(API_URL);
        return response.json();
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data.status} API: {API_URL}</div>;
      }
      `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import 'side-effect';
      import { useLoaderData } from 'expo-router';
      import { jsxs as _jsxs } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsxs("div", {
          children: [data.status, " API: ", API_URL]
        });
      }"
    `);
  });
});

describe('edge cases', () => {
  it('handles files with no loader export', () => {
    expect(
      transformTest(
        `
      export default function Index() {
        return <div>Index</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        return /*#__PURE__*/_jsx("div", {
          children: "Index"
        });
      }"
    `);
  });

  it('handles files with only loader export', () => {
    expect(
      transformTest(
        `
      export async function loader() {
        return { data: 'test' };
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`""`);
  });

  it('handles self-referential functions (recursion)', () => {
    expect(
      transformTest(
        `
      import { useLoaderData } from 'expo-router';

      function factorial(n) {
        return n <= 1 ? 1 : n * factorial(n - 1);
      }

      export async function loader() {
        return factorial(5);
      }

      export default function Index() {
        const data = useLoaderData();
        return <div>{data}</div>;
      }
    `,
        false
      ).code
    ).toMatchInlineSnapshot(`
      "import { useLoaderData } from 'expo-router';
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Index() {
        const data = useLoaderData();
        return /*#__PURE__*/_jsx("div", {
          children: data
        });
      }"
    `);
  });
});
