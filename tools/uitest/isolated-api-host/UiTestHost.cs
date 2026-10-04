using Septem.Integration.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http;

public sealed class UiFactory : SeptemApiFactory {
  protected override void ConfigureTestConfiguration(IDictionary<string, string?> cfg) {
    cfg["Platform:SuperAdmin:Email"] = "super@septem.local";
    cfg["Platform:SuperAdmin:Password"] = "super123";
    cfg["Platform:SuperAdmin:Name"] = "UI Test Admin";
    cfg["Provisioning:DirectAdmin:Endpoint"] = "";
    cfg["Provisioning:VerificationTimeoutMinutes"] = "0.05";
    cfg["Logging:LogLevel:Microsoft.EntityFrameworkCore"] = "Warning";
    cfg["Logging:LogLevel:Default"] = "Warning";
    cfg["Seed:Tenants:2:TenantId"] = "prefeitura-x-hml";
    cfg["Seed:Tenants:2:ClienteNome"] = "Prefeitura X";
    cfg["Seed:Tenants:2:AmbienteNome"] = "Sistema HML";
    cfg["Seed:Tenants:2:Host"] = "prefeitura-x-hml.localhost";
    cfg["Seed:Tenants:2:DbName"] = "db_x_hml_" + Suffix;
    cfg["Seed:Tenants:2:PrimaryColor"] = "#0ea5e9";
    cfg["Seed:Tenants:2:Purpose"] = "staging";
  }
}
public static class UiTestHost {
  public static async Task Main(string[] args) {
    if (Environment.GetEnvironmentVariable("SEPTEM_UI_TEST_ISOLATED") != "1")
      throw new InvalidOperationException("Set SEPTEM_UI_TEST_ISOLATED=1 and use a disposable local PostgreSQL instance.");
    var connection = Environment.GetEnvironmentVariable("SEPTEM_TEST_POSTGRES")
      ?? throw new InvalidOperationException("SEPTEM_TEST_POSTGRES must point to disposable local PostgreSQL.");
    var parsed = new Npgsql.NpgsqlConnectionStringBuilder(connection);
    if (parsed.Host is not ("localhost" or "127.0.0.1" or "::1"))
      throw new InvalidOperationException("The UI test bridge only accepts loopback PostgreSQL.");
    await using var factory = new UiFactory();
    await factory.InitializeAsync();
    var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect=false, BaseAddress=new Uri("http://localhost") });
    var builder = WebApplication.CreateBuilder(args);
    builder.WebHost.UseUrls("http://127.0.0.1:5058");
    var app = builder.Build();
    app.MapGet("/__septem_ui_test_host", () => new { isolated=true, externalResources="simulated", database="temporary-postgres", application="SeptemApiFactory" });
    app.MapMethods("/{**path}", new[] { "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS" }, async context => {
      var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), context.Request.Path + context.Request.QueryString);
      if (context.Request.ContentLength is > 0 || context.Request.Headers.ContainsKey("Transfer-Encoding")) {
        var data = new MemoryStream(); await context.Request.Body.CopyToAsync(data); data.Position=0;
        request.Content = new StreamContent(data);
      }
      foreach (var header in context.Request.Headers) {
        if (header.Key.Equals("Host", StringComparison.OrdinalIgnoreCase)) continue;
        if (!request.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray())) request.Content?.Headers.TryAddWithoutValidation(header.Key,header.Value.ToArray());
      }
      using var response = await client.SendAsync(request);
      context.Response.StatusCode=(int)response.StatusCode;
      foreach (var header in response.Headers.Concat(response.Content.Headers)) context.Response.Headers[header.Key] = header.Value.ToArray();
      context.Response.Headers.Remove("transfer-encoding");
      await response.Content.CopyToAsync(context.Response.Body);
    });
    Console.WriteLine("Isolated Septem test API bridge http://127.0.0.1:5058; external DNS/TLS/provider resources simulated, HTTP application and Postgres real.");
    await app.RunAsync();
  }
}
