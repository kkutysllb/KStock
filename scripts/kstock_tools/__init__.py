"""KStock 自有工具包。

包含金融搜索相关工具：
  - akshare_data_tool：A 股/港股/美股金融数据查询（行情、K 线、财报等）
  - akshare_news_tool：财经新闻搜索（东方财富个股新闻 + CCTV 新闻联播）

两个工具在 config/qilin.config.yaml 的 tools 段中预配置，
引擎启动后自动加载为 agent 可用工具。

数据源：akshare（东方财富/新浪财经，国内免费无限流）。
"""
