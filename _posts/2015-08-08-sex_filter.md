
---
title: 色情文本分类器设计 - 一次机器学习实践
category：ml
---

最近有个小项目，做的是从用户访问过的网页内容进行色情文本过滤。在项目中，所学习到的技术为pig与scikit-learn。本文从项目背景出发，简单地介绍了如何使用scikit-learn进行分类器设计。

色情文本分类器设计，在机器学习中为一个有监督的学习问题。这类问题都可以遵循以下设计方法进行：

+ 收集训练数据与测试数据。
+ 对数据进行特征提取和特征变换。
+ 保留较为有效的特征，抛弃无效或噪音特征。
+ 选择一种分类器，进行分类器训练。
+ 对分类器进行交叉校验(cross validation)，从中得出较优的超参数。
+ 在测试集上进行数据测试。


# 数据收集 #
在项目中，其他工程师已经把爬取好的网页内容保存到HDFS中。这些数据是没有标签的，为了应用有监督学习方法，必须想办法给数据添加上标签。同时由于文本量巨大，需选择一种较为廉价的数据标注方法。在项目中我是这样解决问题的：

+ 构造黄色短语词典。观察数据，人为找出少数的黄色文章。从黄色文章中，选出极其敏感的黄色短语构成词典。这里极其敏感的含义是，如果出现该短语，则几乎可以认为这篇文章是色情文章。在这里，简单的使用正则表达式匹配会出现问题，比如“交通口交接处”会匹配到“口交”这个敏感词。解决这种问题的方法是先对文章内容和黄色短语进行分词，然后直接使用分词后的黄色短语对分词后的文章进行匹配。
+ 找出那些大部分内容为黄色内容的网站。这里我的判断准则是：
  - 若一个网页内容包含两个及以上的黄色短语，则认为该网页是黄色网页。
  - 若一个网站的网页中，50%以上的网页为黄色网页，则认为是黄色网站。
+ 选取2中所有黄色网站中所有黄色网页，这些网页内容标记为正样本。


# 特征提取与特征变换 #
在这一步中的作用是将文章内容变为数值特征。在信息检索领域中，这类问题已经有比较成熟的解决方案。一种表示方式是，统计文章中各个词的出现次数，将各个词的出现次数作为一个数字特征。在scikit-learn中，完成这个转换类是sklearn.feature_extraction.text.CountVectorizer。

简单的统计词语出现次数并不是一种比较好的做法。比如，考虑“我“、”的“、”是“这些词语。这词语几乎在每篇文章中都会出现，所以认为其包含的信息量并不多。在信息检索中，有一种表示词语信息量的衡量方式，idf。出现该词语的文章数越小，idf值越高，反之亦然。上述的”我“、”的“、”是“这些词语的idf值就很低。在scikit-learn中，完成这个转换的类是sklearn.feature_extraction.text.TfidfTransformer。


# 特征选择 #
在上一步中，提取的特征可能有很多是没有用的。除此之外，特征数目（词语数目）过多也会占用较多内存。比如像"apir8181"这种无意义的id标识符，其在所有文章中出现次数过少，本身并不包含太多信息，因此排除掉。在项目中，我的特征选择方式是：

1. 基于词频的特征选择。词语出现次数过少或者过多，都可以认为该词语并没有太多用处。因此，可将出现次数过少或过多的词语排除掉。另外，鉴于分类器性能限制，词语数目不能过多。此时，可将经过排除后的词语中，选出出现次数最多的n个。
2. 基于统计量的特征选择。考虑到1中是基于词频的方式进行特征选择，并没有利用样本的类别信息。在这里，我使用了基于卡方统计量的特征选择方式，找出统计量最大的k个词语。在scikit-learn中，对应的类为sklearn.feature_selection.SelectKBest和chi2函数。


# 分类器训练 #
有监督学习的分类器选择较多，经过调研后，发现multinomial naive bayes、logisitc regression和svm的在这类问题上效果较好。考虑到训练时间复杂度和实用程度，最后选择了logistic regression，对应的类为sklearn.linear_model.LogisticRegression。

在sklearn中，有将上述几个步骤串联起来的类sklearn.pipeline.Pipeline。将特征提取变换、特征选择、分类器训练几个步骤结合起来

{:.prettyprint .lang-py}
    self._clf = Pipeline([
        ('count', CountVectorizer(max_df=.9, min_df=20, max_features=100000)),
        ('tfidf', TfidfTransformer()),
        ('kbest', SelectKBest(chi2, k='all')),
        ('clf', LogisticRegression(penalty='l2', tol=1e-4, C=10))
    ])


# 交叉校验 #
在机器学习中，一个模型或分类器经常有众多参数需要输入。这些参数的选择对结果影响非常的大。选择这些参数的一种常见做法是，将部分训练数据留作校验集，并对参数空间进行搜索，选择在校验结果中最好的参数。在本项目中，交叉校验的方法如下：

{:.prettyprint .lang-py}
    param_grid = {
        'tfidf__use_idf': [True, False],
        'kbest__k': [1000, 10000, 30000, "all"],
        'clf__penalty': ['l1', 'l2'],
        'clf__C': [0.1, 1, 3, 10]
    }

    kfold = KFold(len(corpus.target), shuffle=True, n_folds=4)
    grid_search = GridSearchCV(self._clf, param_grid=param_grid, cv=kfold, n_jobs=1, verbose=3)
    grid_search.fit(corpus.data, corpus.target)

    print "Best params:"
    for param, value in grid_search.best_params_.items():
        print "\t" + param + ":" + str(value)

# 结果 #

数据描述如下：

| adult | non_adult | total | description |
| ----- | --------- | ----- | ----------- |
| 109640 | 99624 | 209264 | 0625-0630抓取数据（训练用）|
| 26994 | 23006 | 176602 | 0701-0703抓取数据（测试用） |

最终训练的模型结果：

| description | precision | recall | f1-score |
| ----------- | --------- | ------ | -------- |
| 正常内容 | 0.97 | 0.97 | 0.97 |
| 色情内容 | 0.97 | 0.96 | 0.97 |
| avg | 0.97 | 0.97 | 0.97 |

从测试结果来看，该分类器有3%的几率会将内容分错。

最后在这里分享一下我所训练出来的模型数据，[all.data](/assets/posts/2015-08-08-sex_filter/all.data)


