#!/usr/bin/env node
/**
 * Generate stardesk-api-baseline.jmx from performance-plan endpoints.
 * Run automatically by run-jmeter-agent.mjs before each JMeter invocation.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { API_ENDPOINTS } from "../performance-plan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "stardesk-api-baseline.jmx");

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function httpSampler(name, pathExpr, method = "GET", body = null) {
  const bodyBlock =
    body && method === "POST"
      ? `
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${xmlEscape(body)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`
      : `
          <boolProp name="HTTPSampler.postBodyRaw">false</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>`;

  return `
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${xmlEscape(name)}" enabled="true">
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" enabled="true">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>
          <stringProp name="HTTPSampler.domain"></stringProp>
          <stringProp name="HTTPSampler.port"></stringProp>
          <stringProp name="HTTPSampler.protocol"></stringProp>
          <stringProp name="HTTPSampler.contentEncoding"></stringProp>
          <stringProp name="HTTPSampler.path">\${__P(BASE_URL,http://localhost:8000)}${pathExpr}</stringProp>
          <stringProp name="HTTPSampler.method">${method}</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.auto_redirects">false</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
          <boolProp name="HTTPSampler.DO_MULTIPART_POST">false</boolProp>
          ${bodyBlock}
        </HTTPSamplerProxy>
        <hashTree>
          <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Assert 2xx/3xx" enabled="true">
            <collectionProp name="Asserion.test_strings">
              <stringProp name="49586">2</stringProp>
            </collectionProp>
            <stringProp name="Assertion.custom_message"></stringProp>
            <stringProp name="Assertion.test_field">Assertion.response_code</stringProp>
            <boolProp name="Assertion.assume_success">false</boolProp>
            <intProp name="Assertion.test_type">8</intProp>
          </ResponseAssertion>
          <hashTree/>
        </hashTree>`;
}

function buildJmx() {
  const samplers = [];

  samplers.push(httpSampler("health", "/health", "GET"));

  samplers.push(`
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="login" enabled="true">
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">{"email":"\${email}","password":"\${password}"}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>
          <stringProp name="HTTPSampler.path">\${__P(BASE_URL,http://localhost:8000)}/api/v1/auth/login</stringProp>
          <stringProp name="HTTPSampler.method">POST</stringProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
          <stringProp name="HTTPSampler.contentEncoding">UTF-8</stringProp>
        </HTTPSamplerProxy>
        <hashTree>
          <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="JSON Content-Type" enabled="true">
            <collectionProp name="HeaderManager.headers">
              <elementProp name="" elementType="Header">
                <stringProp name="Header.name">Content-Type</stringProp>
                <stringProp name="Header.value">application/json</stringProp>
              </elementProp>
            </collectionProp>
          </HeaderManager>
          <hashTree/>
          <JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="Extract access_token" enabled="true">
            <stringProp name="JSONPostProcessor.referenceNames">access_token</stringProp>
            <stringProp name="JSONPostProcessor.jsonPathExprs">$.access_token</stringProp>
            <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
            <stringProp name="JSONPostProcessor.defaultValues">MISSING_TOKEN</stringProp>
          </JSONPostProcessor>
          <hashTree/>
        </hashTree>`);

  samplers.push(`
        <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Authorization Bearer" enabled="true">
          <collectionProp name="HeaderManager.headers">
            <elementProp name="" elementType="Header">
              <stringProp name="Header.name">Authorization</stringProp>
              <stringProp name="Header.value">Bearer \${access_token}</stringProp>
            </elementProp>
          </collectionProp>
        </HeaderManager>
        <hashTree/>`);

  samplers.push(httpSampler("tickets-list", "/api/v1/tickets", "GET"));

  samplers.push(`
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="tickets-list-extract" enabled="true">
          <stringProp name="HTTPSampler.path">\${__P(BASE_URL,http://localhost:8000)}/api/v1/tickets</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
        </HTTPSamplerProxy>
        <hashTree>
          <JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="Extract ticket_id" enabled="true">
            <stringProp name="JSONPostProcessor.referenceNames">ticket_id</stringProp>
            <stringProp name="JSONPostProcessor.jsonPathExprs">$[0].id</stringProp>
            <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
            <stringProp name="JSONPostProcessor.defaultValues">00000000-0000-4000-8000-000000000001</stringProp>
          </JSONPostProcessor>
          <hashTree/>
        </hashTree>`);

  samplers.push(httpSampler("ticket-detail", "/api/v1/tickets/\${ticket_id}", "GET"));
  samplers.push(httpSampler("dashboard", "/api/v1/reports/dashboard", "GET"));
  samplers.push(httpSampler("categories", "/api/v1/categories", "GET"));
  samplers.push(httpSampler("kanban-boards", "/api/v1/kanban/boards", "GET"));

  samplers.push(`
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="kanban-boards-extract" enabled="true">
          <stringProp name="HTTPSampler.path">\${__P(BASE_URL,http://localhost:8000)}/api/v1/kanban/boards</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
        </HTTPSamplerProxy>
        <hashTree>
          <JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="Extract board_id" enabled="true">
            <stringProp name="JSONPostProcessor.referenceNames">board_id</stringProp>
            <stringProp name="JSONPostProcessor.jsonPathExprs">$[0].id</stringProp>
            <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
            <stringProp name="JSONPostProcessor.defaultValues">00000000-0000-4000-8000-000000000002</stringProp>
          </JSONPostProcessor>
          <hashTree/>
        </hashTree>`);

  samplers.push(httpSampler("kanban-board-detail", "/api/v1/kanban/boards/\${board_id}", "GET"));

  const endpointComment = API_ENDPOINTS.map((e) => e.label).join("; ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="STARDESK API Baseline" enabled="true">
      <stringProp name="TestPlan.comments">${xmlEscape(endpointComment)}</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
    </TestPlan>
    <hashTree>
      <CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="User pool CSV" enabled="true">
        <stringProp name="delimiter">,</stringProp>
        <stringProp name="fileEncoding">UTF-8</stringProp>
        <stringProp name="filename">\${__P(USERS_CSV,users.csv)}</stringProp>
        <boolProp name="ignoreFirstLine">true</boolProp>
        <boolProp name="quotedData">true</boolProp>
        <boolProp name="recycle">true</boolProp>
        <stringProp name="shareMode">shareMode.all</stringProp>
        <boolProp name="stopThread">false</boolProp>
        <stringProp name="variableNames">email,password</stringProp>
      </CSVDataSet>
      <hashTree/>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="API journey" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">\${__P(LOOPS,1)}</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">\${__P(VUS,10)}</stringProp>
        <stringProp name="ThreadGroup.ramp_time">\${__P(RAMP_SECONDS,10)}</stringProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
        <stringProp name="ThreadGroup.duration">\${__P(DURATION_SECONDS,60)}</stringProp>
        <stringProp name="ThreadGroup.delay"></stringProp>
        <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
      </ThreadGroup>
      <hashTree>
        ${samplers.join("\n")}
        <ConstantTimer guiclass="ConstantTimerGui" testclass="ConstantTimer" testname="Think time" enabled="true">
          <stringProp name="ConstantTimer.delay">\${__P(THINK_TIME_MS,150)}</stringProp>
        </ConstantTimer>
        <hashTree/>
      </hashTree>
      <ResultCollector guiclass="SummaryReport" testclass="ResultCollector" testname="Summary Report" enabled="true">
        <boolProp name="ResultCollector.error_logging">false</boolProp>
        <objProp>
          <name>saveConfig</name>
          <value class="SampleSaveConfiguration">
            <time>true</time>
            <latency>true</latency>
            <timestamp>true</timestamp>
            <success>true</success>
            <label>true</label>
            <code>true</code>
            <message>true</message>
            <threadName>true</threadName>
            <dataType>true</dataType>
            <encoding>false</encoding>
            <assertions>true</assertions>
            <subresults>true</subresults>
            <responseData>false</responseData>
            <samplerData>false</samplerData>
            <xml>false</xml>
            <fieldNames>true</fieldNames>
            <responseHeaders>false</responseHeaders>
            <requestHeaders>false</requestHeaders>
            <responseDataOnError>false</responseDataOnError>
            <saveAssertionResultsFailureMessage>true</saveAssertionResultsFailureMessage>
            <assertionsResultsToSave>0</assertionsResultsToSave>
            <bytes>true</bytes>
            <sentBytes>true</sentBytes>
            <url>true</url>
            <threadCounts>true</threadCounts>
            <idleTime>true</idleTime>
            <connectTime>true</connectTime>
          </value>
        </objProp>
        <stringProp name="filename"></stringProp>
      </ResultCollector>
      <hashTree/>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`;
}

writeFileSync(OUT, buildJmx(), "utf8");
console.log(`Generated ${OUT}`);
