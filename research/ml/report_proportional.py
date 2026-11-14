"""Report corrected nested training fractions on both available datasets."""
import json
from pathlib import Path
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix

ROOT=Path(__file__).resolve().parent


def main():
    lines=['# Сравнение моделей с исправленными долями обучения','',
      'Обучающие подвыборки вложены и отбираются по целым прогонам. Для каждой номинальной доли '
      'общее число прогонов округляется до ближайшего целого; каждый сценарий представлен хотя бы одним прогоном. '
      'На малом проверенном наборе это ровно 6, 9 и 12 из 12 прогонов. Наличие некоторых сценариев '
      'только одним прогоном в обучении ограничивает выводы.', '',
      'MLP выбирает предел итераций из 50, 100 и 150 по независимой групповой validation; '
      'Transformer выбирает эпоху по той же группе. Пороговые правила обучаются на train. '
      'Показан Macro-F1: среднее ± стандартное отклонение по пяти разделениям после усреднения '
      'трёх seed внутри каждого. Окна и повторно используемые прогоны не независимы.', '']
    for title,folder in [('Малый набор с проверенными интервалами','verified_proportional'),
                         ('Исторический исследовательский набор','historical_proportional')]:
        path=ROOT/folder;config=json.loads((path/'config.json').read_text())
        if config['subset_mode']!='proportional' or config['mlp_selection']!='grouped':raise ValueError('wrong protocol')
        scores=pd.read_csv(path/'macro_f1_by_split.csv')
        lines += ['## '+title,'','| Модель | 50% | 75% | 100% |','|---|---:|---:|---:|']
        for model in ('rules','rf','mlp','transformer'):
            values=[]
            for fraction in (.5,.75,1.):
                row=scores[(scores.model==model)&(scores.fraction==fraction)&(~scores.temporal)].iloc[0]
                values.append(f"{row['mean']:.3f} ± {row['std']:.3f}")
            lines.append(f'| {model} | '+' | '.join(values)+' |')
        subsets=json.loads((path/'train_subsets.json').read_text())
        ranges={str(frac):[min(len(s['train_runs']) for s in subsets if s['fraction']==frac),
                           max(len(s['train_runs']) for s in subsets if s['fraction']==frac)] for frac in (.5,.75,1.)}
        lines+=['',f'Количество обучающих прогонов по разделениям: `{ranges}`.', '',
                f'![Зависимость качества от объёма]({folder}/learning_curves.png)', '']
        predictions=pd.read_csv(path/'predictions.csv.gz')
        fig,axes=plt.subplots(1,4,figsize=(12,3.4));labels=['norm','fault','attack']
        for ax,model in zip(axes,('rules','rf','mlp','transformer')):
            g=predictions[(predictions.model==model)&(predictions.fraction==1)&
                          (predictions.split==0)&(predictions.seed==0)]
            cm=confusion_matrix(g.truth,g.prediction,labels=labels);ax.imshow(cm,cmap='Blues');ax.set_title(model)
            ax.set_xticks(range(3),labels,rotation=45);ax.set_yticks(range(3),labels)
            for i in range(3):
                for j in range(3):ax.text(j,i,str(cm[i,j]),ha='center',va='center',
                                         color='white' if cm[i,j]>cm.max()/2 else 'black')
        fig.tight_layout();fig.savefig(path/'confusion_split0.png',dpi=160);plt.close(fig)
        lines+=['Матрицы одного разделения и seed; строки — истинный класс, столбцы — прогноз.', '',
                f'![Матрицы ошибок]({folder}/confusion_split0.png)', '']
        if folder=='verified_proportional':
            p=predictions[(predictions.fraction==1)&(~predictions.temporal)]
            lines+=['Для пары одинаковых 401 (доли окон, объединённых по разделениям и seed):','',
                    '| Модель | сбой → атака | атака → сбой |','|---|---:|---:|']
            for model in ('rules','rf','mlp','transformer'):
                g=p[p.model==model];fault=g[g.truth=='fault'];attack=g[g.truth=='attack']
                lines.append(f"| {model} | {(fault.prediction=='attack').mean():.3f} | "
                             f"{(attack.prediction=='fault').mean():.3f} |")
            lines+=['']
    lines += ['Исторический набор остаётся исследовательским: timestamps исходных отсчётов и подтверждение '
      'инъекций отсутствуют, дополнительный lookback `rate()` не учитывался. Малый набор содержит '
      'четыре синтетических сценария и один стенд; распределение классов не отражает реальную частоту атак.', '',
      'Предсказания всех окон, составы разделений и подвыборок, параметры, матрицы и времена сохранены '
      'в соответствующих каталогах. Замеры времени выполнялись одновременно с другими задачами и не '
      'являются сравнительным бенчмарком. Предыдущие расчёты с округлением отдельно по сценариям '
      'сохранены для прослеживаемости и обозначены как номинальные доли.', '',
      'Для воспроизведения запустить `experiment_audited.py` с `--subset-mode proportional '
      '--mlp-selection grouped`, указав `--data` и `--out`, затем выполнить `summarize_audited.py` '
      'с теми же путями и `report_proportional.py`.']
    (ROOT/'PROPORTIONAL_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('\n'.join(lines))


if __name__=='__main__':main()
