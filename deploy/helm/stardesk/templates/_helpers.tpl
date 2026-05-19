{{- define "stardesk.name" -}}
stardesk
{{- end }}

{{- define "stardesk.labels" -}}
app.kubernetes.io/part-of: {{ include "stardesk.name" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}
