---
title: 微信公众平台开发小记
category: system
---

**本文是在原博客kazenoyu.me上迁移过来**

最近参加了微信的创新班，在这个班上，我需要做一些编程作业。而其中一个作业就是使用微信公众平台创建一个帐号，这个帐号的内容是自己定制的。我选择了广州图书馆自助平台作为微信公众号的内容，它含有的功能非常简单，能够简单的查看一个帐号的借阅信息、查询某本图书的信息以及提供续借的功能。我使用的技术相当简单，使用python的bottle框架作为httpserver，requests库解决http请求处理的问题，例如使用cookie记录账户信息。

刚开始的时候是打算使用django的，因为最近有使用django的经验。后来觉得使用django有点杀鸡用牛刀的感觉，于是便选择了bottle框架。
研究了好半天，总于能在服务器上跑bottle的http server。最难解决的问题是如何部署bottle。由于我跟ddmbr、dreamingo的vps上有各种各样的服务，其中包括一个很复杂的apache server。由于不懂这些东西，在配置问题上浪费了很多时间。当时在网上搜了很多东西，尝试过bottle+nginx+uwsgi的方法，但是还是没有部署好。最后的解决方法是把apache的index.html删除掉，因为时间问题只能这样粗暴的解决了。

**Bottle**

bottle的安装相当的简单，运行以下命令即可

{:.prettyprint}
    pip install bottle



**微信开放平台**

接下来我们来研究微信公众平台的api,这个api还真是简单到极点啊，真心觉得写得挺好的。  
微信开放平台的api文档里面说，当用户访问你的公众平台帐号时，腾讯会发送GET请求到你的公众平台处理服务器，里面有signature等参数，而我们需要相应的是一个xml。

微信开放平台GET参数:
* signature: 微信加密签名
* timestamp: 时间戳
* nonce: 随机数
* echostr: 随机字符串

由于这个开放平台的验证方式实在过于简单，在这里我不对其使用作详细说明。我把自己的代码贴一下出来，方便以后进行查询。

{:.prettyprint}
    from bottle import route,run,request
    import bottle
    from hashlib import sha1
    from time import time
    import xml.etree.ElementTree as ET

    #对所有请求/路径的GET方法,验证加密方法
    @route('/',method='GET')
    def verify():
        try:
            print request.GET
            signature = request.GET.get('signature')
            timestamp = request.GET.get('timestamp')
            nonce = request.GET.get('nonce')
            echostr = request.GET.get('echostr')
            
            token ='gzlib'#你的开发者token
            L = [token,timestamp,nonce]
            L.sort()
            temp = ''.join(L)
            hashstr = sha1(temp).hexdigest()
            if hashstr == signature:
            return echostr
        except Exception:
            return 'Verify Error'

    #解析xml树，我这里用的是elementtree,有更好的方法请告知
    def parse():
        root = ET.fromstring(request.body.read())
        message = {}
        for child in root:
            message[child.tag] = child.text
        return message

    #用户发送的信息，原封不动地返回
    @route('/',method='POST')
    def handleUserInput():
        message = parse()
        s =  """
        <xml>
            <from>%s</from>
            <to>%s</to>
            <timestamp>%s</timestamp>
            <content>%s</content>
        </xml>
        """ %(message['FromUserName'], message['ToUserName'],
              str(int(time())), message['Content'])
        return s

刚开始的时候不清楚ssh的机制，直接使用命令:

{:.prettyprint}
    python index.wsgi &
    
结果出大事了，因为这样做的话是使用当前ssh链接的bash运行这个脚本的。当ssh一断开python就会自动挂掉，后来折腾两个小时在想怎么通过uwsgi去用这个脚本，结果还是配置不成功。最后找到的解决方案linux的简单命令nohup。

{:.prettyprint}
    nohup python index.wsgi &
    
大功告成！！时间紧迫也没时间再写多点了。赶紧去把连接数据库处理逻辑部分的方法写了。  
微信的创新班作业真多啊，连续逃两个星期课去写这些作业了。

