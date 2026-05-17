# Schema Operation Dry Run

Use this when debugging schema-backed AI edits without touching the iframe bridge.

## Endpoint

```bash
curl 'http://localhost:5173/api/projects/<project-id>/chat/dry-run' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "message": "把标题改成客户管理工作台",
    "pageId": "page-demo",
    "pageSource": "schema",
    "pageSchema": {
      "page": {
        "id": "page-demo",
        "title": "Demo",
        "layout": "dashboard",
        "sections": [
          {
            "id": "header",
            "component": "PageHeader",
            "role": "hero",
            "label": "页面头部",
            "variant": "default",
            "props": {
              "title": "旧标题",
              "description": "旧描述"
            }
          }
        ]
      }
    },
    "selectedNode": {
      "id": "header.title",
      "component": "PageHeader",
      "role": "title",
      "label": "旧标题"
    },
    "aiContent": "{\"operations\":[{\"type\":\"replaceText\",\"target\":\"header.title\",\"text\":\"客户管理工作台\"}]}"
  }'
```

Expected response:

```json
{
  "mode": {
    "isSchemaMode": true,
    "isFragmentMode": false,
    "wantsLayoutRewrite": false,
    "isOperationMode": false
  },
  "didApply": true,
  "event": {
    "type": "applied",
    "schemaOperations": [
      {
        "type": "replaceText",
        "target": "header.title",
        "text": "客户管理工作台"
      }
    ],
    "mode": "schema-operations"
  },
  "message": null
}
```

## Notes

- `pageSource: "schema"` and `pageSchema` are what force schema mode.
- The dry-run route only parses AI output and reports the event shape. It does not mutate project data.
- The real chat route streams the same `schemaOperations` event, then the client validates and applies it to Page Schema.
